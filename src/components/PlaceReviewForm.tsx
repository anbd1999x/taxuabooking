"use client";

import { useActionState, useState } from "react";
import { submitPlaceReview, type ReviewState } from "@/app/(site)/place-actions";

/** Form gửi đánh giá quán (không cần tài khoản — admin duyệt rồi mới hiện). */
export function PlaceReviewForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitPlaceReview, {});
  const [rating, setRating] = useState(5);

  if (state.ok) {
    return (
      <div className="rounded-xl bg-forest-50 p-4 text-sm font-medium text-forest-800">
        ✅ {state.message}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-sm font-semibold text-gray-700">Chấm điểm:</span>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            aria-label={`${i} sao`}
            className={`text-2xl transition ${i <= rating ? "" : "opacity-25 grayscale"}`}
          >
            ⭐
          </button>
        ))}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-[220px_minmax(0,1fr)]">
        <input
          name="name"
          placeholder="Tên của bạn *"
          required
          className="rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-forest-500"
        />
        <input
          name="content"
          placeholder="Bạn thấy quán thế nào? (đồ ăn, view, phục vụ...) *"
          required
          minLength={10}
          className="rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-forest-500"
        />
      </div>
      {state.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="self-start rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-700 disabled:opacity-50"
      >
        {pending ? "Đang gửi…" : "Gửi đánh giá"}
      </button>
    </form>
  );
}
