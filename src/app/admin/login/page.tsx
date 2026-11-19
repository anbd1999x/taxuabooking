"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest-600 text-lg font-bold text-white">
            TX
          </span>
          <h1 className="mt-3 text-xl font-bold text-ink">Quản trị Tà Xùa Booking</h1>
          <p className="text-sm text-gray-500">Đăng nhập để quản lý dịch vụ</p>
        </div>

        <form action={action} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Tên đăng nhập / Email / SĐT</span>
            <input
              name="username"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Mật khẩu</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </label>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:opacity-50"
          >
            {pending ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <div className="mt-5 border-t border-gray-100 pt-5">
          <a href="/api/auth/google?mode=partner" rel="nofollow" className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50">
            <span className="text-base font-black text-[#4285F4]">G</span> Chủ homestay: đăng nhập bằng Google
          </a>
          <p className="mt-2 text-center text-xs text-gray-400">Lần đầu đăng nhập sẽ tự tạo tài khoản dùng thử.</p>
        </div>
      </div>
    </div>
  );
}
