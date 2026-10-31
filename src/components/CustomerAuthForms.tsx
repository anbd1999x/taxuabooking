"use client";

import { useActionState, useState } from "react";
import { loginAction, registerAction, type AuthState } from "@/app/(site)/tai-khoan/actions";

const field =
  "w-full rounded-xl border border-gray-200 px-3.5 py-3 text-[15px] outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200";

export function CustomerAuthForms({ next }: { next: string }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginState, login, lp] = useActionState<AuthState, FormData>(loginAction, {});
  const [regState, register, rp] = useActionState<AuthState, FormData>(registerAction, {});

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-bold transition ${tab === t ? "bg-white text-forest-700 shadow-sm" : "text-gray-500"}`}
          >
            {t === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
        ))}
      </div>

      {tab === "login" ? (
        <form action={login} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <input name="phone" inputMode="tel" placeholder="Số điện thoại" className={field} autoComplete="tel" />
          <input name="password" type="password" placeholder="Mật khẩu" className={field} autoComplete="current-password" />
          {loginState.error && <p className="text-sm font-semibold text-red-600">{loginState.error}</p>}
          <button disabled={lp} className="rounded-xl bg-forest-600 py-3 text-[15px] font-bold text-white hover:bg-forest-700 disabled:opacity-60">
            {lp ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      ) : (
        <form action={register} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <input name="name" placeholder="Họ và tên" className={field} autoComplete="name" />
          <input name="phone" inputMode="tel" placeholder="Số điện thoại (VD: 0397943155)" className={field} autoComplete="tel" />
          <input name="password" type="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)" className={field} autoComplete="new-password" />
          {regState.error && <p className="text-sm font-semibold text-red-600">{regState.error}</p>}
          <button disabled={rp} className="rounded-xl bg-forest-600 py-3 text-[15px] font-bold text-white hover:bg-forest-700 disabled:opacity-60">
            {rp ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
          </button>
        </form>
      )}

      {/* Đăng nhập mạng xã hội — bật khi có thông tin OAuth. */}
      <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" /> hoặc <span className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled title="Đang cập nhật" className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-400">
          <span>G</span> Google
        </button>
        <button type="button" disabled title="Đang cập nhật" className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-400">
          <span>f</span> Facebook
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">Đăng nhập Google/Facebook sẽ bật sau khi cấu hình.</p>
    </div>
  );
}
