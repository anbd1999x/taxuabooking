"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "@/components/Link";
import type { FeedbackStatus, FeedbackType } from "@prisma/client";
import {
  agoText,
  feedbackStatus,
  feedbackType,
  FEEDBACK_TYPES,
  isVideoUrl,
} from "@/lib/feedback";
import { thumbUrl } from "@/lib/image-loader";
import { addComment, toggleVote } from "@/app/(site)/gop-y/actions";
import { useT } from "@/components/i18n/I18nProvider";

export interface WallComment {
  id: string;
  authorName: string;
  avatar: string | null; // ảnh Google / Facebook của người viết (null = hiện chữ cái đầu)
  content: string;
  isAdmin: boolean;
  mins: number;
}

export interface WallItem {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  areas: string[];
  message: string;
  authorName: string; // đã xử lý ẩn danh ở server
  avatar: string | null; // ẩn danh ⇒ null
  anon: boolean; // ẩn danh ⇒ hiện hình người thay cho chữ cái đầu
  media: string[]; // ảnh / video đính kèm (url /uploads/…)
  mine: boolean;
  mins: number;
  mood: number | null;
  votes: number;
  voted: boolean;
  reply: string | null;
  pinned: boolean;
  comments: WallComment[];
}

const LOGIN_HREF = "/tai-khoan?next=/gop-y";

function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

// Màu nền vòng tròn chữ cái (tài khoản không có ảnh — đăng ký bằng SĐT): chọn theo tên để mỗi người một màu cố định.
const AVATAR_TONES = [
  ["#dff3e6", "#17663b"],
  ["#ffe9d1", "#b45a0c"],
  ["#e3ecff", "#2a55c0"],
  ["#fbe3ee", "#b0306b"],
  ["#ece6ff", "#5b3fc4"],
  ["#dbf3f4", "#0f6f78"],
];

/** Ảnh đại diện tròn: ảnh Google / Facebook nếu có (lỗi tải ⇒ chữ cái đầu); không có ảnh ⇒ vòng tròn màu + chữ cái đầu tên; ẩn danh ⇒ hình người. */
function Avatar({ name, url, size = 28, admin = false, anon = false }: { name: string; url: string | null; size?: number; admin?: boolean; anon?: boolean }) {
  const [broken, setBroken] = useState(false);
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  const box = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (url && !broken)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} style={box} className="flex-none rounded-full object-cover ring-1 ring-black/5" />
    );
  if (admin)
    return (
      <span aria-hidden style={box} className="flex flex-none items-center justify-center rounded-full bg-forest-700 font-extrabold text-white">
        TX
      </span>
    );
  if (anon)
    return (
      <span aria-hidden style={box} className="flex flex-none items-center justify-center rounded-full bg-gray-200 text-gray-500">
        <svg viewBox="0 0 24 24" width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} fill="currentColor">
          <circle cx="12" cy="8.5" r="4" />
          <path d="M4 20.5c0-4.1 3.6-6.5 8-6.5s8 2.4 8 6.5z" />
        </svg>
      </span>
    );
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR_TONES[h % AVATAR_TONES.length];
  return (
    <span aria-hidden style={{ ...box, background: bg, color: fg }} className="flex flex-none items-center justify-center rounded-full font-extrabold ring-1 ring-black/5">
      {letter}
    </span>
  );
}

/** Lưới ảnh / video đính kèm dưới nội dung góp ý: ảnh bấm để xem lớn, video phát tại chỗ. */
function MediaStrip({ media, onOpen }: { media: string[]; onOpen: (url: string) => void }) {
  const tr = useT();
  if (!media.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {media.map((u) =>
        isVideoUrl(u) ? (
          <video
            key={u}
            src={`${u}#t=0.1`}
            controls
            playsInline
            preload="metadata"
            className="max-h-64 w-full max-w-sm rounded-xl border border-gray-200 bg-black"
          />
        ) : (
          <button
            key={u}
            type="button"
            onClick={() => onOpen(u)}
            title={tr("Xem ảnh lớn")}
            className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl(u, 384)} alt={tr("Ảnh đính kèm")} loading="lazy" className="h-28 w-28 object-cover sm:h-36 sm:w-36" />
          </button>
        ),
      )}
    </div>
  );
}

export function FeedbackWall({
  items: initial,
  loggedIn,
  myAvatar = null,
}: {
  items: WallItem[];
  loggedIn: boolean;
  myAvatar?: string | null;
}) {
  const tr = useT();
  const [items, setItems] = useState<WallItem[]>(initial);
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [type, setType] = useState<"all" | FeedbackType>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [zoom, setZoom] = useState<string | null>(null); // ảnh đính kèm đang xem lớn

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);
  const [, startTransition] = useTransition();

  function flash(msg: string) {
    setToast(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(""), 2600);
  }

  const doneCount = useMemo(() => items.filter((f) => f.status === "DONE").length, [items]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const t of FEEDBACK_TYPES) c[t.key] = items.filter((f) => f.type === t.key).length;
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const list = items.filter((f) => type === "all" || f.type === type);
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return sort === "new" ? a.mins - b.mins : b.votes - a.votes;
    });
  }, [items, type, sort]);

  function onVote(f: WallItem) {
    if (!loggedIn) return;
    const nextVoted = !f.voted;
    setItems((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, voted: nextVoted, votes: x.votes + (nextVoted ? 1 : -1) } : x)),
    );
    startTransition(async () => {
      const r = await toggleVote(f.id);
      if (r.error) {
        setItems((prev) =>
          prev.map((x) => (x.id === f.id ? { ...x, voted: f.voted, votes: f.votes } : x)),
        );
        flash(tr(r.error));
      }
    });
  }

  function onComment(f: WallItem) {
    const text = (drafts[f.id] ?? "").trim();
    if (!loggedIn || !text) return;
    const optimistic: WallComment = { id: "tmp-" + Date.now(), authorName: tr("Bạn"), avatar: myAvatar, content: text, isAdmin: false, mins: 0 };
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, comments: [...x.comments, optimistic] } : x)));
    setDrafts((d) => ({ ...d, [f.id]: "" }));
    startTransition(async () => {
      const r = await addComment(f.id, text);
      if (r.error) {
        setItems((prev) =>
          prev.map((x) => (x.id === f.id ? { ...x, comments: x.comments.filter((c) => c.id !== optimistic.id) } : x)),
        );
        flash(tr(r.error));
      }
    });
  }

  const tabs: { key: "all" | FeedbackType; name: string }[] = [
    { key: "all", name: tr("Tất cả") },
    ...FEEDBACK_TYPES.map((t) => ({ key: t.key, name: t.short })),
  ];

  return (
    <section className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{tr("Bảng góp ý công khai")}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {tr("{0} góp ý · {1} đã làm · ai cũng xem được, đăng nhập để gửi và bình chọn", [items.length, doneCount])}
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
          {([["hot", tr("Nhiều bình chọn")], ["new", tr("Mới nhất")]] as const).map(([k, name]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
                sort === k ? "bg-white text-forest-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tr(name)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const on = type === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition ${
                on ? "border-forest-600 bg-forest-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tr(t.name)} <span className="opacity-70">{counts[t.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-sm text-gray-500">
          {tr("Chưa có góp ý nào ở mục này. Hãy là người đầu tiên!")}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((f) => {
            const ty = feedbackType(f.type);
            const st = feedbackStatus(f.status);
            const open = openId === f.id;
            return (
              <article
                key={f.id}
                className="grid grid-cols-[52px_minmax(0,1fr)] gap-3.5 rounded-2xl border bg-white p-4 shadow-sm sm:gap-4"
                style={{ borderColor: f.mine ? "#f5d9a8" : "rgba(0,0,0,0.06)" }}
              >
                {loggedIn ? (
                  <button
                    type="button"
                    onClick={() => onVote(f)}
                    title={tr("Bình chọn")}
                    className="flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-xl border transition"
                    style={{
                      borderColor: f.voted ? "#f59e0b" : "#e5e7eb",
                      background: f.voted ? "#fff7ed" : "white",
                      color: f.voted ? "#ea580c" : "#4b5563",
                    }}
                  >
                    <span className="text-xs leading-none">▲</span>
                    <span className="text-base font-extrabold leading-none">{f.votes}</span>
                  </button>
                ) : (
                  <Link
                    href={LOGIN_HREF}
                    title={tr("Đăng nhập để bình chọn")}
                    className="flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-xl border border-gray-200 bg-white text-gray-400 transition hover:border-sunset-300 hover:text-sunset-500"
                  >
                    <span className="text-xs leading-none">▲</span>
                    <span className="text-base font-extrabold leading-none">{f.votes}</span>
                  </Link>
                )}

                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={f.authorName} url={f.avatar} size={38} anon={f.anon} />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-extrabold text-ink">
                        {tr(f.authorName)}
                        {f.mine && <span className="font-semibold text-gray-400">{" "}{tr("(bạn)")}</span>}
                      </div>
                      <div className="text-xs text-gray-500">{agoText(f.mins, tr)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge bg={ty.bg} fg={ty.fg}>{tr(ty.short)}</Badge>
                    <Badge bg={st.bg} fg={st.fg}>{tr(st.name)}</Badge>
                    {f.areas.map((a) => (
                      <span key={a} className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                        {tr(a)}
                      </span>
                    ))}
                  </div>

                  <p className="whitespace-pre-line text-[15px] leading-relaxed text-gray-800">{tr(f.message)}</p>

                  <MediaStrip media={f.media} onOpen={setZoom} />

                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-gray-500">
                    {f.mood ? <span>{tr("Chấm web {0}/5", [f.mood])}</span> : null}
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : f.id)}
                      className="font-bold text-forest-700 hover:underline"
                    >
                      {open ? tr("Ẩn bình luận") : f.comments.length ? tr("{0} bình luận", [f.comments.length]) : tr("Bình luận")}
                    </button>
                  </div>

                  {f.reply && (
                    <div className="rounded-xl bg-forest-50 px-3 py-2.5 text-[13px] leading-relaxed text-forest-800">
                      <b>{tr("Tà Xùa Booking:")}</b> {tr(f.reply)}
                    </div>
                  )}

                  {open && (
                    <div className="flex flex-col gap-2 border-l-2 border-gray-100 pl-3">
                      {f.comments.map((c) => (
                        <div key={c.id} className="flex gap-2 text-[13px] leading-snug">
                          <Avatar name={c.authorName} url={c.avatar} size={30} admin={c.isAdmin} />
                          <div className="min-w-0">
                            <b className={c.isAdmin ? "text-forest-700" : "text-gray-700"}>
                              {c.isAdmin ? tr("Tà Xùa Booking") : tr(c.authorName)}
                            </b>
                            <span className="text-gray-400"> · {agoText(c.mins, tr)}</span>
                            <div className="text-gray-600">{tr(c.content)}</div>
                          </div>
                        </div>
                      ))}
                      {loggedIn ? (
                        <div className="flex gap-1.5">
                          <input
                            value={drafts[f.id] ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onComment(f);
                            }}
                            placeholder={tr("Viết bình luận…")}
                            maxLength={500}
                            className="min-w-0 flex-1 rounded-full border border-gray-200 px-3.5 py-2 text-[13px] focus:border-forest-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => onComment(f)}
                            className="whitespace-nowrap rounded-full bg-forest-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-forest-800"
                          >
                            {tr("Gửi")}
                          </button>
                        </div>
                      ) : (
                        <Link href={LOGIN_HREF} className="text-[13px] font-semibold text-forest-700 hover:underline">
                          {tr("Đăng nhập để bình luận →")}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl(zoom, 1440)} alt={tr("Ảnh đính kèm")} className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label={tr("Đóng")}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white hover:bg-white/25"
          >
            ×
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {tr(toast)}
        </div>
      )}
    </section>
  );
}
