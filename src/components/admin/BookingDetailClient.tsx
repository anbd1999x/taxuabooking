"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { BookingStatus } from "@prisma/client";
import { showToast } from "./Toast";
import {
  saveBookingStage,
  recordBookingPayment,
  addBookingNote,
  deleteBooking,
  type BookingActionState,
} from "@/app/admin/bookings/actions";

/** Hiện toast theo kết quả server action {ok,error,message}. */
function useResultToast(state: BookingActionState, onOk?: () => void) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.ok) {
      showToast(state.message || "Đã lưu", "ok");
      onOk?.();
    } else if (state.error) showToast(state.error, "error");
  }, [state, onOk]);
}

/** Nút sao chép vào clipboard, đổi nhãn + toast khi chép xong. */
export function CopyChip({
  text,
  label,
  toast = "Đã sao chép",
  className = "",
}: {
  text: string;
  label: string;
  toast?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard bị chặn thì vẫn báo để admin tự chép tay */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
        showToast(toast, "ok");
      }}
      className={`whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 transition hover:bg-gray-50 ${className}`}
    >
      {done ? "Đã chép ✓" : label}
    </button>
  );
}

const STATUS_OPTS: { value: BookingStatus; name: string; d: string; dot: string; bd: string; bg: string }[] = [
  { value: "NEW", name: "Mới", d: "Vừa nhận, chưa ai xử lý", dot: "bg-sky-500", bd: "border-sky-400", bg: "bg-sky-50" },
  { value: "CONTACTING", name: "Đang liên hệ", d: "Đã gọi / nhắn, chờ khách", dot: "bg-amber-500", bd: "border-amber-400", bg: "bg-amber-50" },
  { value: "CONFIRMED", name: "Đã xác nhận", d: "Nhà cung cấp giữ chỗ, chờ cọc", dot: "bg-forest-500", bd: "border-forest-400", bg: "bg-forest-50" },
  { value: "COMPLETED", name: "Hoàn thành", d: "Khách đã dùng dịch vụ", dot: "bg-forest-700", bd: "border-forest-600", bg: "bg-forest-50" },
  { value: "CANCELLED", name: "Đã huỷ", d: "Ghi lý do để thống kê", dot: "bg-red-500", bd: "border-red-400", bg: "bg-red-50" },
];

const CANCEL_REASONS = ["Khách đổi lịch", "Hết chỗ, không sắp được", "Khách không liên lạc được", "Khác"];

/** Panel đổi trạng thái đơn: chọn 1 trong 5 bước, huỷ phải kèm lý do. */
export function StatusPanel({
  id,
  status,
  cancelReason,
}: {
  id: string;
  status: BookingStatus;
  cancelReason: string | null;
}) {
  const [picked, setPicked] = useState<BookingStatus>(status);
  const [state, action, pending] = useActionState<BookingActionState, FormData>(saveBookingStage, {});
  useResultToast(state);
  const cur = STATUS_OPTS.find((o) => o.value === picked)!;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={picked} />
      <div className="flex flex-col gap-1.5">
        {STATUS_OPTS.map((o) => {
          const on = picked === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setPicked(o.value)}
              className={`flex items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition ${
                on ? `${o.bd} ${o.bg}` : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <span className={`h-4 w-4 flex-none rounded-full border-2 ${on ? `${o.dot} border-transparent` : "border-gray-300 bg-white"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{o.name}</span>
                <span className="block text-xs text-gray-500">{o.d}</span>
              </span>
            </button>
          );
        })}
      </div>
      {picked === "CANCELLED" && (
        <select
          name="cancelReason"
          defaultValue={cancelReason ?? ""}
          className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
        >
          <option value="">Lý do huỷ…</option>
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`rounded-full px-4 py-3 text-[15px] font-extrabold text-white transition disabled:opacity-50 ${
          picked === "CANCELLED" ? "bg-red-600 hover:bg-red-700" : "bg-forest-700 hover:bg-sunset-500"
        }`}
      >
        {pending ? "Đang lưu…" : picked === "CANCELLED" ? "Huỷ đơn" : `Lưu trạng thái: ${cur.name}`}
      </button>
    </form>
  );
}

/** Ghi nhận tiền thu: chip gợi ý số tiền + ô nhập + hình thức + Ghi nhận / Thu đủ. */
export function PaymentRecordForm({
  id,
  price,
  collected,
}: {
  id: string;
  price: number | null;
  collected: number;
}) {
  const [amt, setAmt] = useState("");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(recordBookingPayment, {});
  useResultToast(state, () => setAmt(""));
  const fmt = (n: number) => n.toLocaleString("vi-VN");
  const due = price != null ? Math.max(0, price - collected) : null;
  const quick: [string, number][] = [
    ["Cọc 500k", 500000],
    ...(price != null ? ([["Cọc 30%", Math.round(price * 0.3)]] as [string, number][]) : []),
    ...(due != null && due > 0 ? ([["Còn lại", due]] as [string, number][]) : []),
  ];

  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs font-bold text-gray-500">Ghi nhận tiền thu</p>
      <div className="flex flex-wrap gap-1.5">
        {quick.map(([name, v]) => (
          <button
            key={name}
            type="button"
            onClick={() => setAmt(fmt(v))}
            className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          name="amount"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          inputMode="numeric"
          placeholder="Số tiền, VD 500.000"
          className="w-full min-w-0 flex-1 rounded-lg border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm font-bold"
        />
        <select name="method" className="rounded-lg border-[1.5px] border-gray-200 bg-white px-2 py-2 text-[13px] font-semibold">
          <option>Chuyển khoản</option>
          <option>Tiền mặt</option>
          <option>CTV thu hộ</option>
        </select>
      </div>
      <div className="flex gap-1.5">
        <button
          name="mode"
          value="add"
          disabled={pending}
          className="flex-1 rounded-full bg-forest-700 px-3 py-2 text-sm font-bold text-white hover:bg-forest-800 disabled:opacity-50"
        >
          Ghi nhận
        </button>
        <button
          name="mode"
          value="full"
          disabled={pending || (due != null && due <= 0)}
          className="flex-1 rounded-full border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Thu đủ
        </button>
      </div>
    </form>
  );
}

/** Ô ghi chú nội bộ + chip ghi chú nhanh. */
export function NoteForm({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(addBookingNote, {});
  useResultToast(state, () => setNote(""));
  const QUICK = ["Đã gọi, khách không nghe", "Khách hẹn cọc tối nay", "Đã gửi STK cho khách", "Khách đổi ngày"];

  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-start gap-2">
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ghi chú nội bộ: đã gọi khách, hẹn cọc, lý do huỷ…"
          className="min-w-0 flex-1 resize-y rounded-xl border-[1.5px] border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed"
        />
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="whitespace-nowrap rounded-full bg-forest-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-forest-800 disabled:opacity-50"
        >
          Thêm
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setNote(q)}
            className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            {q}
          </button>
        ))}
      </div>
    </form>
  );
}

/** Nút xoá hẳn yêu cầu, hỏi xác nhận trước khi gửi. */
export function DeleteBookingButton({ id, code }: { id: string; code: string }) {
  return (
    <form
      action={deleteBooking}
      onSubmit={(e) => {
        if (!confirm(`Xoá yêu cầu ${code}? Nên chọn "Đã huỷ" thay vì xoá để giữ thống kê.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-[13px] font-bold text-red-600 hover:text-red-700">Xoá yêu cầu</button>
    </form>
  );
}
