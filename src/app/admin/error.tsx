"use client";

/**
 * Error boundary khu quản trị: hiện thông báo thao tác bị chặn (vd xoá
 * phòng/chuyến đang có đơn giữ chỗ) và cho quay lại thay vì trang trắng.
 * Lưu ý: ở bản production, Next che message gốc của lỗi server (digest),
 * nên kèm hướng dẫn chung.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const masked = !error.message || /digest|server components/i.test(error.message);
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
      <div className="text-4xl">⚠️</div>
      <h1 className="mt-3 text-lg font-bold text-ink">Thao tác không thực hiện được</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {masked
          ? "Thường do dữ liệu đang được một đơn đặt giữ chỗ (không thể xoá/sửa đè). Hãy kiểm tra và huỷ/hoàn tất các đơn liên quan trước, rồi thử lại."
          : error.message}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={() => history.back()} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">← Quay lại</button>
        <button onClick={reset} className="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">Thử lại</button>
      </div>
    </div>
  );
}
