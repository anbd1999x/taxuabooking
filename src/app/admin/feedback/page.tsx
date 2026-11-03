import type { FeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { getSettings } from "@/lib/queries";
import {
  FB_OWNER_KEY,
  FB_POSTS_KEY,
  FB_PROFILE_KEY,
  FEEDBACK_STATUSES,
  feedbackStatus,
  feedbackType,
} from "@/lib/feedback";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  deleteFeedback,
  replyFeedback,
  saveFbConfig,
  setFeedbackStatus,
  toggleHidden,
  togglePin,
} from "./actions";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const POSTS_PLACEHOLDER = `[
  {
    "title": "Mọi người góp ý giúp mình giao diện mới nhé",
    "text": "Mình vừa làm lại trang đặt combo…",
    "image": "/uploads/xxx.jpg",
    "url": "https://facebook.com/...",
    "date": "30/10/2026",
    "stats": "128 thích · 46 bình luận",
    "cmtBy": "Thu Hà",
    "cmt": "Phần chọn căn dễ hiểu…",
    "open": true
  }
]`;

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filterRaw = str(sp.status);
  const filter = FEEDBACK_STATUSES.some((s) => s.key === filterRaw) ? (filterRaw as FeedbackStatus) : undefined;

  const [rows, settings, counts] = await Promise.all([
    prisma.feedback.findMany({
      where: filter ? { status: filter } : {},
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        _count: { select: { votes: true, comments: true } },
        customer: { select: { name: true, phone: true } },
      },
    }),
    getSettings(),
    prisma.feedback.groupBy({ by: ["status"], _count: true }),
  ]);

  const total = counts.reduce((s, c) => s + c._count, 0);
  const countOf = (k: FeedbackStatus) => counts.find((c) => c.status === k)?._count ?? 0;

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "", label: "Tất cả", count: total },
    ...FEEDBACK_STATUSES.map((s) => ({ key: s.key, label: s.name, count: countOf(s.key) })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Góp ý của khách</h1>
        <p className="mt-1 text-sm text-gray-500">
          Đọc, đổi trạng thái và trả lời góp ý. Trang công khai:{" "}
          <a href="/gop-y" target="_blank" className="font-semibold text-forest-700">/gop-y ↗</a>
        </p>
      </header>

      {/* Cấu hình khối Facebook */}
      <details className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <summary className="cursor-pointer text-sm font-bold text-ink">Khối "Góp ý qua Facebook" (cấu hình)</summary>
        <ActionForm action={saveFbConfig} className="mt-3 flex flex-col gap-3" success="Đã lưu khối Facebook.">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-gray-600">Link trang cá nhân Facebook</span>
            <input
              name="profile"
              defaultValue={settings[FB_PROFILE_KEY] || settings.contactFacebook || ""}
              placeholder="https://facebook.com/..."
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-gray-600">Tên hiển thị trên bài viết</span>
            <input
              name="owner"
              defaultValue={settings[FB_OWNER_KEY] || ""}
              placeholder="Chủ Tà Xùa Booking"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-gray-600">
              Danh sách bài viết (JSON mảng) — để trống thì chỉ hiện nút "Xem trang cá nhân"
            </span>
            <textarea
              name="posts"
              defaultValue={settings[FB_POSTS_KEY] || ""}
              rows={8}
              placeholder={POSTS_PLACEHOLDER}
              className="rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs leading-relaxed"
            />
          </label>
          <button className="w-fit rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
            Lưu khối Facebook
          </button>
        </ActionForm>
      </details>

      {/* Lọc theo trạng thái */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const on = (filter ?? "") === t.key;
          return (
            <a
              key={t.key}
              href={t.key ? `/admin/feedback?status=${t.key}` : "/admin/feedback"}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${
                on ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.label} ({t.count})
            </a>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-gray-500">
          Chưa có góp ý nào.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((f) => {
            const ty = feedbackType(f.type);
            const st = feedbackStatus(f.status);
            return (
              <div
                key={f.id}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${f.hidden ? "ring-red-200" : "ring-black/5"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: ty.bg, color: ty.fg }}>{ty.short}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.name}</span>
                    {f.pinned && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">📌 Ghim</span>}
                    {f.hidden && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">Đã ẩn</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    ▲ {f._count.votes} · 💬 {f._count.comments} · {formatDate(f.createdAt)}
                  </div>
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  <b className="text-gray-700">{f.anon ? `${f.authorName} (ẩn tên công khai)` : f.authorName}</b>
                  {f.customer?.phone ? ` · ${f.customer.phone}` : ""}
                  {f.mood ? ` · chấm web ${f.mood}/5` : ""}
                </div>

                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{f.message}</p>

                {f.areas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.areas.map((a) => (
                      <span key={a} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{a}</span>
                    ))}
                  </div>
                )}

                {f.screenshot && (
                  <a href={f.screenshot} target="_blank" rel="noopener noreferrer" className="mt-2 block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.screenshot} alt="Ảnh chụp màn hình" className="max-h-40 rounded-lg border border-gray-200" />
                  </a>
                )}

                {/* Trả lời chính thức */}
                <ActionForm action={replyFeedback} className="mt-3 flex flex-col gap-2" success="Đã lưu trả lời.">
                  <input type="hidden" name="id" value={f.id} />
                  <textarea
                    name="reply"
                    defaultValue={f.reply ?? ""}
                    rows={2}
                    placeholder="Trả lời công khai (hiện khung xanh dưới góp ý)…"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button className="w-fit rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">
                    Lưu trả lời
                  </button>
                </ActionForm>

                {/* Hành động */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
                  <span className="mr-1 text-xs font-semibold text-gray-400">Trạng thái:</span>
                  {FEEDBACK_STATUSES.map((s) => (
                    <form key={s.key} action={setFeedbackStatus}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="status" value={s.key} />
                      <button
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ${
                          f.status === s.key ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {s.name}
                      </button>
                    </form>
                  ))}
                  <span className="mx-1 h-4 w-px bg-gray-200" />
                  <form action={togglePin}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                      {f.pinned ? "Bỏ ghim" : "Ghim"}
                    </button>
                  </form>
                  <form action={toggleHidden}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                      {f.hidden ? "Hiện lại" : "Ẩn"}
                    </button>
                  </form>
                  <form action={deleteFeedback}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                      Xoá
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
