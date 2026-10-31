"use client";

import { useActionState } from "react";
import { updatePhoneAction, type PhoneState } from "@/app/(site)/tai-khoan/actions";

export function PhoneUpdateForm() {
  const [state, action, pending] = useActionState<PhoneState, FormData>(updatePhoneAction, {});
  return (
    <form action={action} className="mt-3 rounded-2xl border border-dashed border-forest-200 bg-forest-50 p-4">
      <div className="text-sm font-semibold text-forest-800">Gắn số điện thoại để xem đơn của bạn</div>
      <p className="mt-1 text-sm text-gray-600">
        Tài khoản của bạn chưa có số điện thoại. Nhập số đã dùng khi đặt dịch vụ để gom các đơn về đây.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          name="phone"
          inputMode="tel"
          placeholder="Số điện thoại (VD: 0397943155)"
          className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
        />
        <button disabled={pending} className="rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-700 disabled:opacity-60">
          {pending ? "Đang lưu…" : "Lưu số"}
        </button>
      </div>
      {state.error && <p className="mt-1 text-sm font-semibold text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-1 text-sm font-semibold text-forest-700">Đã lưu số điện thoại. Các đơn sẽ hiển thị bên dưới.</p>}
    </form>
  );
}
