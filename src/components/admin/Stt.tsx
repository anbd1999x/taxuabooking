/** Số thứ tự (STT) của một dòng trong danh sách admin — nhãn nhỏ đứng trước tên / mã. */
export function Stt({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      title={`STT ${n}`}
      className={`inline-flex h-5 min-w-[22px] flex-none items-center justify-center rounded-md bg-gray-100 px-1 text-[11px] font-bold tabular-nums text-gray-500 ${className}`}
    >
      {n}
    </span>
  );
}

/** Ô tiêu đề + ô dữ liệu cột STT cho các bảng admin. */
export const STT_TH = "w-12 px-3 py-3 text-center";
export const STT_TD = "px-3 py-3 text-center text-xs font-semibold tabular-nums text-gray-400";
