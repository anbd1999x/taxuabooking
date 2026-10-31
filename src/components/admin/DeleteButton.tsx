"use client";

/**
 * Nút xoá chạy bằng server action qua `formAction` (lấy input ẩn của form cha),
 * kèm hộp thoại xác nhận để tránh xoá nhầm và cho người dùng phản hồi tức thì.
 */
export function DeleteButton({
  action,
  label = "Xoá",
  confirmText = "Bạn chắc chắn muốn xoá?",
  className = "rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50",
}: {
  action: (formData: FormData) => void | Promise<void>;
  label?: string;
  confirmText?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className={className}
    >
      {label}
    </button>
  );
}
