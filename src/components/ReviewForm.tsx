"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "@/app/(site)/review-actions";

export function ReviewForm({
  serviceId,
  path,
  initialRating = 0,
  initialComment = "",
}: {
  serviceId: string;
  path: string;
  initialRating?: number;
  initialComment?: string;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);

  return (
    <form action={action} className="rounded-2xl bg-forest-50 p-4 ring-1 ring-forest-100">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="rating" value={rating} />
      <div className="text-sm font-semibold text-forest-800">{initialRating ? "Cập nhật đánh giá của bạn" : "Đánh giá dịch vụ này"}</div>
      <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} sao`}
            className="text-3xl leading-none transition"
            style={{ color: (hover || rating) >= n ? "#f59e0b" : "#d1d5db" }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        name="comment"
        defaultValue={initialComment}
        rows={3}
        maxLength={1000}
        placeholder="Chia sẻ trải nghiệm của bạn (tuỳ chọn)…"
        className="mt-2 w-full rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
      />
      {state.error && <p className="mt-1 text-sm font-semibold text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-1 text-sm font-semibold text-forest-700">Cảm ơn đánh giá của bạn!</p>}
      <button
        disabled={pending || rating < 1}
        className="mt-2 rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-700 disabled:opacity-60"
      >
        {pending ? "Đang gửi…" : "Gửi đánh giá"}
      </button>
    </form>
  );
}
