"use client";

import { useActionState, useEffect, useRef } from "react";
import { showToast } from "./Toast";

export interface FormResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Bọc <form> dùng server action trả về {ok,error,message} và tự hiện toast
 * thành công / thất bại. Nút Xoá bên trong có thể dùng formAction riêng.
 */
export function ActionForm({
  action,
  children,
  className,
  success = "Đã lưu thành công",
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  children: React.ReactNode;
  className?: string;
  success?: string;
}) {
  const [state, formAction] = useActionState<FormResult, FormData>(action, {});
  const last = useRef(state);

  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.ok) showToast(state.message || success, "ok");
    else if (state.error) showToast(state.error, "error");
  }, [state, success]);

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  );
}
