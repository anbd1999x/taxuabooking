"use client";

import { useActionState, useMemo, useState } from "react";
import { submitPlaceReview, type ReviewState } from "@/app/(site)/place-actions";

export interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  content: string;
  date: string; // đã format sẵn ở server
}

const G = "oklch(0.29 0.055 160)";
const ACCENT = "oklch(0.68 0.18 45)";
const GOLD = "oklch(0.75 0.16 70)";
const BAR = "oklch(0.55 0.12 155)";
const BORDER = "oklch(0.92 0.01 160)";
const MUTED = "oklch(0.48 0.02 160)";
const AVATARS = ["oklch(0.55 0.12 155)", "oklch(0.5 0.1 250)", "oklch(0.6 0.15 30)", "oklch(0.45 0.08 200)", "oklch(0.55 0.1 320)", "oklch(0.5 0.12 100)"];

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export function PlaceReviews({
  placeId,
  reviews,
  avg,
  count,
  distribution,
}: {
  placeId: string;
  reviews: ReviewItem[];
  avg: number | null;
  count: number;
  distribution: [number, number, number, number, number]; // [5★, 4★, 3★, 2★, 1★]
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitPlaceReview, {});
  const [writing, setWriting] = useState(false);
  const [pick, setPick] = useState(0);
  const [filter, setFilter] = useState(0); // 0 = tất cả, hoặc số sao
  const [shown, setShown] = useState(3);

  const filtered = useMemo(() => (filter ? reviews.filter((r) => r.rating === filter) : reviews), [reviews, filter]);
  const visible = filtered.slice(0, shown);

  const filters: [number, string][] = [[0, `Tất cả (${count})`], [5, "5 sao"], [4, "4 sao"], [3, "3 sao"]];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Đánh giá từ khách</h2>
        {!state.ok && (
          <button type="button" onClick={() => setWriting((v) => !v)} className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sunset-500" style={{ background: G }}>
            {writing ? "Đóng" : "Viết đánh giá"}
          </button>
        )}
      </div>

      {/* Tổng quan điểm */}
      {count > 0 ? (
        <div className="grid gap-5 rounded-[18px] border bg-white p-5 sm:grid-cols-[auto_minmax(0,1fr)]" style={{ borderColor: BORDER }}>
          <div className="flex flex-col items-start gap-1">
            <div className="text-[52px] font-extrabold leading-none tracking-[-0.04em]">{(avg ?? 0).toFixed(1).replace(".", ",")}</div>
            <div className="text-[18px] tracking-[2px]" style={{ color: GOLD }}>{stars(Math.round(avg ?? 0))}</div>
            <div className="text-[13px]" style={{ color: MUTED }}>{count} đánh giá</div>
          </div>
          <div className="flex flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((star, i) => {
              const n = distribution[i];
              const pct = count ? Math.round((n / count) * 100) : 0;
              return (
                <div key={star} className="grid items-center gap-2.5 text-[13px] font-semibold" style={{ gridTemplateColumns: "52px minmax(0,1fr) 36px", color: MUTED }}>
                  <span>{star} sao</span>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "oklch(0.93 0.01 160)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BAR }} />
                  </div>
                  <span className="text-right">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-[18px] border bg-white px-5 py-6 text-sm" style={{ borderColor: BORDER, color: MUTED }}>
          Chưa có đánh giá nào — hãy là người đầu tiên chia sẻ trải nghiệm của bạn!
        </div>
      )}

      {/* Form viết đánh giá */}
      {state.ok ? (
        <div className="rounded-[18px] border px-5 py-4 text-sm font-semibold" style={{ background: "oklch(0.95 0.025 155)", borderColor: "oklch(0.9 0.04 155)", color: "oklch(0.3 0.08 155)" }}>
          ✅ {state.message}
        </div>
      ) : writing ? (
        <form action={action} className="flex flex-col gap-3 rounded-[18px] border p-5" style={{ background: "oklch(0.95 0.025 155)", borderColor: "oklch(0.9 0.04 155)" }}>
          <input type="hidden" name="placeId" value={placeId} />
          <input type="hidden" name="rating" value={pick || 5} />
          <div className="text-base font-extrabold">Bạn chấm quán mấy sao?</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setPick(n)} aria-label={`${n} sao`} className="text-[30px] leading-none transition" style={{ color: n <= pick ? GOLD : "oklch(0.88 0.01 160)" }}>★</button>
            ))}
          </div>
          <input name="name" required placeholder="Tên của bạn *" className="w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] outline-none" style={{ borderColor: "oklch(0.88 0.015 160)" }} />
          <textarea name="content" required minLength={10} rows={3} placeholder="Bạn tới lúc mấy giờ, không gian và đồ ăn/đồ uống ra sao…" className="w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-[15px] outline-none" style={{ borderColor: "oklch(0.88 0.015 160)" }} />
          {state.error && <div className="text-[13px] font-semibold" style={{ color: "oklch(0.55 0.19 28)" }}>{state.error}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className="rounded-full px-[18px] py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: ACCENT }}>
              {pending ? "Đang gửi…" : "Gửi đánh giá"}
            </button>
            <button type="button" onClick={() => setWriting(false)} className="px-3.5 py-3 text-sm font-bold" style={{ color: MUTED }}>Huỷ</button>
          </div>
        </form>
      ) : null}

      {/* Bộ lọc + danh sách */}
      {count > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {filters.map(([k, name]) => (
              <button key={k} type="button" onClick={() => { setFilter(k); setShown(3); }} className="whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-bold" style={{ background: filter === k ? G : "white", color: filter === k ? "white" : "oklch(0.35 0.02 160)", borderColor: BORDER }}>
                {name}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {visible.map((r, i) => (
              <article key={r.id} className="flex flex-col gap-2.5 rounded-[18px] border bg-white px-5 py-[18px]" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: AVATARS[i % AVATARS.length] }}>{initials(r.name)}</div>
                    <div className="text-[15px] font-extrabold">{r.name}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm tracking-[1px]" style={{ color: GOLD }}>{stars(r.rating)}</span>
                    <span className="text-xs" style={{ color: MUTED }}>{r.date}</span>
                  </div>
                </div>
                <div className="text-[15px] leading-[1.65]" style={{ color: "oklch(0.3 0.02 160)" }}>{r.content}</div>
              </article>
            ))}
            {visible.length === 0 && (
              <div className="rounded-[18px] border bg-white px-5 py-6 text-sm" style={{ borderColor: BORDER, color: MUTED }}>Chưa có đánh giá {filter} sao.</div>
            )}
          </div>

          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + 3)} className="self-center rounded-full border bg-white px-5 py-3 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>
              Xem thêm đánh giá
            </button>
          )}
        </>
      )}
    </section>
  );
}
