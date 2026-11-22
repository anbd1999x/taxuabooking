import "server-only";
import crypto from "node:crypto";
import { prisma } from "./prisma";

/**
 * CHAT TRỰC TIẾP khách ↔ admin. Khách (khung chat desktop, `FloatingContact`) nhận diện bằng cookie httpOnly
 * `tx_chat` = ChatThread.token — không cần đăng nhập. Admin trả lời ở /admin/chat. Cả hai phía hỏi tin mới theo
 * chu kỳ (polling) bằng mốc `after` — không giữ kết nối mở, hợp với 2 bản app sau nginx.
 */

export const CHAT_COOKIE = "tx_chat";
export const CHAT_MAX_LEN = 1000;

export type ChatMsg = { id: string; from: "guest" | "admin"; body: string; at: string; adminName?: string | null };

export const newChatToken = () => crypto.randomBytes(24).toString("hex");
export const validToken = (t: string | undefined | null): t is string => !!t && /^[0-9a-f]{48}$/.test(t);

/** Chuẩn hoá nội dung tin: bỏ ký tự điều khiển, gộp dòng trống, cắt độ dài. */
export function cleanBody(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, CHAT_MAX_LEN);
}
export function cleanLine(s: unknown, max = 80): string | null {
  if (typeof s !== "string") return null;
  const v = s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return v || null;
}

function toMsg(m: { id: string; from: string; body: string; createdAt: Date; adminName: string | null }): ChatMsg {
  return { id: m.id, from: m.from === "admin" ? "admin" : "guest", body: m.body, at: m.createdAt.toISOString(), adminName: m.adminName };
}

function parseAfter(after: string | null | undefined): Date | null {
  if (!after) return null;
  const d = new Date(after);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ------------------------------------------------------------------ phía KHÁCH

export async function guestThread(token: string, after?: string | null) {
  const t = await prisma.chatThread.findUnique({ where: { token }, select: { id: true, name: true, phone: true, status: true } });
  if (!t) return null;
  const since = parseAfter(after);
  const msgs = await prisma.chatMessage.findMany({
    where: { threadId: t.id, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return { name: t.name, phone: t.phone, status: t.status, messages: msgs.map(toMsg) };
}

export async function guestSend(opts: {
  token: string | null;
  body: string;
  page?: string | null;
  locale?: string | null;
  ip?: string | null;
  visitorId?: string | null;
  name?: string | null;
  phone?: string | null;
}): Promise<{ token: string; message: ChatMsg; created: boolean }> {
  const now = new Date();
  let thread = opts.token ? await prisma.chatThread.findUnique({ where: { token: opts.token } }) : null;
  const created = !thread;
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: { token: newChatToken(), page: opts.page, locale: opts.locale, ip: opts.ip, visitorId: opts.visitorId, name: opts.name, phone: opts.phone },
    });
  }
  const [msg] = await prisma.$transaction([
    prisma.chatMessage.create({ data: { threadId: thread.id, from: "guest", body: opts.body } }),
    prisma.chatThread.update({
      where: { id: thread.id },
      data: {
        unreadAdmin: { increment: 1 },
        lastMessageAt: now,
        lastGuestAt: now,
        status: "open",
        ...(opts.page ? { page: opts.page } : {}),
        ...(opts.ip ? { ip: opts.ip } : {}),
        ...(opts.visitorId ? { visitorId: opts.visitorId } : {}),
        ...(opts.name ? { name: opts.name } : {}),
        ...(opts.phone ? { phone: opts.phone } : {}),
      },
    }),
  ]);

  // Mọi tin của khách đều đẩy Web Push cho admin (chống spam đã có giới hạn tần suất ở /api/chat).
  const who = opts.name || thread.name || "Khách";
  void import("./push")
    .then(({ pushToAdmins }) =>
      pushToAdmins({ title: `💬 ${who} nhắn trên web`, body: opts.body.slice(0, 140), url: `/admin/chat?t=${thread!.id}` }),
    )
    .catch((e) => console.warn("[chat] push lỗi", e));
  return { token: thread.token, message: toMsg(msg), created };
}

export async function guestProfile(token: string, name: string | null, phone: string | null) {
  await prisma.chatThread.updateMany({ where: { token }, data: { name, phone } });
}

export async function guestSeen(token: string) {
  await prisma.chatThread.updateMany({ where: { token }, data: { guestSeenAt: new Date() } });
}

// ------------------------------------------------------------------ phía ADMIN

export type ChatThreadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  page: string | null;
  visitorId: string | null;
  ip: string | null;
  locale: string | null;
  status: string;
  unread: number;
  lastAt: string;
  preview: string;
  lastFrom: "guest" | "admin" | null;
  guestSeenAt: string | null;
};

export async function adminThreads(filter: "open" | "closed" | "all" = "open"): Promise<ChatThreadRow[]> {
  const rows = await prisma.chatThread.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: [{ lastMessageAt: "desc" }],
    take: 100,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    page: t.page,
    visitorId: t.visitorId,
    ip: t.ip,
    locale: t.locale,
    status: t.status,
    unread: t.unreadAdmin,
    lastAt: t.lastMessageAt.toISOString(),
    preview: t.messages[0]?.body.slice(0, 120) ?? "",
    lastFrom: (t.messages[0]?.from as "guest" | "admin" | undefined) ?? null,
    guestSeenAt: t.guestSeenAt?.toISOString() ?? null,
  }));
}

export async function adminMessages(threadId: string, after?: string | null): Promise<ChatMsg[]> {
  const since = parseAfter(after);
  const msgs = await prisma.chatMessage.findMany({
    where: { threadId, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return msgs.map(toMsg);
}

export async function adminReply(threadId: string, body: string, adminName: string | null): Promise<ChatMsg | null> {
  const t = await prisma.chatThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!t) return null;
  const now = new Date();
  const [msg] = await prisma.$transaction([
    prisma.chatMessage.create({ data: { threadId, from: "admin", body, adminName } }),
    // Admin trả lời = đã đọc hết tin khách.
    prisma.chatThread.update({ where: { id: threadId }, data: { lastMessageAt: now, unreadAdmin: 0, status: "open" } }),
  ]);
  return toMsg(msg);
}

export async function adminRead(threadId: string) {
  await prisma.chatThread.updateMany({ where: { id: threadId, unreadAdmin: { gt: 0 } }, data: { unreadAdmin: 0 } });
}

export async function adminSetStatus(threadId: string, status: "open" | "closed") {
  await prisma.chatThread.updateMany({ where: { id: threadId }, data: { status, ...(status === "closed" ? { unreadAdmin: 0 } : {}) } });
}

export async function adminDelete(threadId: string) {
  await prisma.chatThread.deleteMany({ where: { id: threadId } });
}

/** Số cuộc chat có tin khách chưa đọc (badge menu admin). */
export async function unreadChatCount(): Promise<number> {
  return prisma.chatThread.count({ where: { unreadAdmin: { gt: 0 } } });
}
