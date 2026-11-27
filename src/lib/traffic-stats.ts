import "server-only";
import { prisma } from "@/lib/prisma";
import { actionTone } from "@/lib/track-labels";
import { classifySource, SESSION_GAP_MS, type SourceKey } from "@/lib/traffic-source";

/**
 * NGUỒN TRUY CẬP — bộ đếm CỘNG DỒN (chỉ tăng, không tính lại từ đầu, không mất theo thời gian).
 *
 * `aggregateTraffic()` đọc nhật ký PageView theo CON TRỎ (SiteSetting `trafficCursor` = {at, id} của dòng cuối đã
 * xử lý), gom thành phiên (≤ 30 phút giữa 2 lượt xem) và CỘNG vào:
 *  - `TrafficDaily` (ngày giờ VN × nguồn): phiên, khách mới, lượt xem, khách gửi đơn, khách liên hệ;
 *  - `TrafficRefHost`: tên miền link giới thiệu / spam (+ IP gần nhất);
 *  - `Visitor.traffic*`: nguồn đầu tiên / nguồn phiên hiện tại / lượt cuối / đã tính đơn – liên hệ.
 * Mỗi dòng PageView chỉ được cộng ĐÚNG MỘT LẦN (con trỏ + khoá advisory trong cùng transaction). Chạy 5 phút/lần
 * trong instrumentation + khi mở /admin/visits; lần đầu tự nạp toàn bộ lịch sử cũ.
 * Bỏ qua dòng mới hơn 15 giây (dòng ghi chậm commit sau vẫn không bị nhảy cóc).
 */

const CURSOR_KEY = "trafficCursor";
const BATCH = 5000;
const SAFE_LAG_MS = 15_000;
const VN_OFFSET_MS = 7 * 3600_000;

/** Ngày giờ VN dạng yyyy-mm-dd. */
export const vnDay = (t: number) => new Date(t + VN_OFFSET_MS).toISOString().slice(0, 10);

type VState = {
  first: string | null;
  cur: string | null;
  lastAt: number | null;
  booked: boolean;
  contacted: boolean;
  exists: boolean;
};
type DayAgg = { sessions: number; newVisitors: number; views: number; booked: number; contacted: number };

/** Xử lý tối đa `maxBatches` lô (5.000 dòng/lô). Trả số dòng đã xử lý (-1 = bản khác đang chạy). */
export async function aggregateTraffic(opts: { maxBatches?: number } = {}): Promise<number> {
  const maxBatches = opts.maxBatches ?? Infinity;
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const n = await prisma.$transaction(
      async (tx) => {
        const [{ ok }] = await tx.$queryRaw<{ ok: boolean }[]>`select pg_try_advisory_xact_lock(hashtext('traffic-agg')) as ok`;
        if (!ok) return -1;
        const curRow = await tx.siteSetting.findUnique({ where: { key: CURSOR_KEY } });
        let cur: { at: string; id: string } | null = null;
        try {
          cur = curRow ? JSON.parse(curRow.value) : null;
        } catch {
          cur = null;
        }
        const until = new Date(Date.now() - SAFE_LAG_MS);
        const rows = await tx.pageView.findMany({
          where: {
            createdAt: { lt: until },
            ...(cur ? { OR: [{ createdAt: { gt: new Date(cur.at) } }, { createdAt: new Date(cur.at), id: { gt: cur.id } }] } : {}),
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: BATCH,
          select: { id: true, visitorId: true, createdAt: true, referrer: true, path: true, action: true, userAgent: true, ip: true },
        });
        if (!rows.length) return 0;

        // Trạng thái khách đang có.
        const ids = [...new Set(rows.map((r) => r.visitorId))];
        const vs = await tx.visitor.findMany({
          where: { id: { in: ids } },
          select: { id: true, trafficFirst: true, trafficCur: true, trafficLastAt: true, trafficBooked: true, trafficContacted: true },
        });
        const state = new Map<string, VState>();
        for (const v of vs)
          state.set(v.id, {
            first: v.trafficFirst,
            cur: v.trafficCur,
            lastAt: v.trafficLastAt?.getTime() ?? null,
            booked: v.trafficBooked,
            contacted: v.trafficContacted,
            exists: true,
          });

        const days = new Map<string, DayAgg>(); // "yyyy-mm-dd|source"
        const bump = (day: string, src: string, k: keyof DayAgg) => {
          const key = `${day}|${src}`;
          let d = days.get(key);
          if (!d) days.set(key, (d = { sessions: 0, newVisitors: 0, views: 0, booked: 0, contacted: 0 }));
          d[k]++;
        };
        const hosts = new Map<string, { source: string; host: string; n: number; ips: string[]; lastAt: Date }>();

        for (const r of rows) {
          let st = state.get(r.visitorId);
          if (!st) state.set(r.visitorId, (st = { first: null, cur: null, lastAt: null, booked: false, contacted: false, exists: false }));
          const t = r.createdAt.getTime();
          const day = vnDay(t);
          if (r.action) {
            // Thao tác không kéo dài phiên; gửi đơn / liên hệ tính 1 lần mỗi khách, gán cho nguồn ĐẦU TIÊN.
            const tone = actionTone(r.action).tone;
            if (tone === "booking" && !st.booked) {
              st.booked = true;
              bump(day, st.first ?? "direct", "booked");
            } else if (tone === "contact" && !st.contacted) {
              st.contacted = true;
              bump(day, st.first ?? "direct", "contacted");
            }
            continue;
          }
          if (st.lastAt == null || t - st.lastAt > SESSION_GAP_MS) {
            const src = classifySource({ referrer: r.referrer, path: r.path, userAgent: r.userAgent });
            st.cur = src.key;
            bump(day, src.key, "sessions");
            if (!st.first) {
              st.first = src.key;
              bump(day, src.key, "newVisitors");
            }
            if (src.key === "referral" || src.key === "spam") {
              const host = (src.host || src.detail || "(không rõ)").slice(0, 200);
              const hk = `${src.key}|${host}`;
              let h = hosts.get(hk);
              if (!h) hosts.set(hk, (h = { source: src.key, host, n: 0, ips: [], lastAt: r.createdAt }));
              h.n++;
              h.lastAt = r.createdAt;
              if (r.ip && !h.ips.includes(r.ip)) h.ips.push(r.ip);
            }
          }
          bump(day, st.cur ?? "direct", "views");
          st.lastAt = t;
        }

        // Ghi trạng thái khách (một câu lệnh cho cả lô).
        const vIds: string[] = [], vF: (string | null)[] = [], vC: (string | null)[] = [], vL: (string | null)[] = [], vB: boolean[] = [], vK: boolean[] = [];
        for (const [id, st] of state) {
          if (!st.exists) continue; // khách chưa có dòng Visitor (hiếm) — bỏ trạng thái
          vIds.push(id);
          vF.push(st.first);
          vC.push(st.cur);
          vL.push(st.lastAt == null ? null : new Date(st.lastAt).toISOString());
          vB.push(st.booked);
          vK.push(st.contacted);
        }
        if (vIds.length)
          await tx.$executeRaw`
            UPDATE "Visitor" v SET "trafficFirst" = u.f, "trafficCur" = u.c, "trafficLastAt" = u.l::timestamp,
              "trafficBooked" = u.b, "trafficContacted" = u.k
            FROM unnest(${vIds}::text[], ${vF}::text[], ${vC}::text[], ${vL}::text[], ${vB}::bool[], ${vK}::bool[]) AS u(id, f, c, l, b, k)
            WHERE v.id = u.id`;

        // Cộng dồn theo ngày × nguồn.
        const dD: string[] = [], dS: string[] = [], dA: number[] = [], dN: number[] = [], dV: number[] = [], dB: number[] = [], dK: number[] = [];
        for (const [key, a] of days) {
          const [d, s] = key.split("|");
          dD.push(d);
          dS.push(s);
          dA.push(a.sessions);
          dN.push(a.newVisitors);
          dV.push(a.views);
          dB.push(a.booked);
          dK.push(a.contacted);
        }
        if (dD.length)
          await tx.$executeRaw`
            INSERT INTO "TrafficDaily" ("day", "source", "sessions", "newVisitors", "views", "booked", "contacted")
            SELECT u.d::date, u.s, u.a, u.n, u.v, u.b, u.k
            FROM unnest(${dD}::text[], ${dS}::text[], ${dA}::int[], ${dN}::int[], ${dV}::int[], ${dB}::int[], ${dK}::int[]) AS u(d, s, a, n, v, b, k)
            ON CONFLICT ("day", "source") DO UPDATE SET
              "sessions" = "TrafficDaily"."sessions" + EXCLUDED."sessions",
              "newVisitors" = "TrafficDaily"."newVisitors" + EXCLUDED."newVisitors",
              "views" = "TrafficDaily"."views" + EXCLUDED."views",
              "booked" = "TrafficDaily"."booked" + EXCLUDED."booked",
              "contacted" = "TrafficDaily"."contacted" + EXCLUDED."contacted"`;

        // Tên miền giới thiệu / spam.
        for (const h of hosts.values()) {
          const old = await tx.trafficRefHost.findUnique({ where: { source_host: { source: h.source, host: h.host } }, select: { ips: true } });
          const ips = [...h.ips.slice().reverse(), ...(old?.ips ?? [])].filter((x, i, a) => a.indexOf(x) === i).slice(0, 10);
          await tx.trafficRefHost.upsert({
            where: { source_host: { source: h.source, host: h.host } },
            create: { source: h.source, host: h.host, sessions: h.n, ips, lastAt: h.lastAt },
            update: { sessions: { increment: h.n }, ips, lastAt: h.lastAt },
          });
        }

        const last = rows[rows.length - 1];
        const value = JSON.stringify({ at: last.createdAt.toISOString(), id: last.id });
        await tx.siteSetting.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value }, update: { value } });
        return rows.length;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    if (n <= 0) break;
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

export interface SourceRow {
  key: SourceKey;
  sessions: number;
  visitors: number; // khách MỚI (lần đầu tới từ nguồn này)
  views: number;
  booked: number;
  contacted: number;
}

export interface TrafficStats {
  total: number;
  rows: SourceRow[];
  referrals: { host: string; sessions: number }[];
  spam: { host: string; sessions: number; ips: string[] }[];
  since: string | null; // ngày bắt đầu của khoảng (yyyy-mm-dd), null = từ trước tới nay
  firstDay: string | null; // ngày sớm nhất có số liệu
  pending: boolean; // còn nhật ký chưa cộng (đang nạp dần)
}

/** Đọc bộ đếm: `sinceDay` = yyyy-mm-dd (giờ VN), null = toàn bộ. Tên miền giới thiệu / spam luôn là từ trước tới nay. */
export async function getTrafficStats(sinceDay: string | null): Promise<TrafficStats> {
  const [grouped, first, refs, spam, cur] = await Promise.all([
    prisma.trafficDaily.groupBy({
      by: ["source"],
      where: sinceDay ? { day: { gte: new Date(`${sinceDay}T00:00:00Z`) } } : {},
      _sum: { sessions: true, newVisitors: true, views: true, booked: true, contacted: true },
    }),
    prisma.trafficDaily.findFirst({ orderBy: { day: "asc" }, select: { day: true } }),
    prisma.trafficRefHost.findMany({ where: { source: "referral" }, orderBy: { sessions: "desc" }, take: 15 }),
    prisma.trafficRefHost.findMany({ where: { source: "spam" }, orderBy: { sessions: "desc" }, take: 30 }),
    prisma.siteSetting.findUnique({ where: { key: CURSOR_KEY } }),
  ]);
  let pending = true;
  try {
    const c = cur ? (JSON.parse(cur.value) as { at: string }) : null;
    if (c) pending = (await prisma.pageView.count({ where: { createdAt: { gt: new Date(c.at), lt: new Date(Date.now() - 10 * 60_000) } } })) > 0;
  } catch {
    /* giữ pending */
  }
  const rows: SourceRow[] = grouped
    .map((g) => ({
      key: g.source as SourceKey,
      sessions: g._sum.sessions ?? 0,
      visitors: g._sum.newVisitors ?? 0,
      views: g._sum.views ?? 0,
      booked: g._sum.booked ?? 0,
      contacted: g._sum.contacted ?? 0,
    }))
    .filter((r) => r.sessions || r.booked || r.contacted)
    .sort((a, b) => b.sessions - a.sessions);
  return {
    total: rows.reduce((s, r) => s + r.sessions, 0),
    rows,
    referrals: refs.map((r) => ({ host: r.host, sessions: r.sessions })),
    spam: spam.map((r) => ({ host: r.host, sessions: r.sessions, ips: r.ips })),
    since: sinceDay,
    firstDay: first ? first.day.toISOString().slice(0, 10) : null,
    pending,
  };
}
