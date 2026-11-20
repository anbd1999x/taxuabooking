"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { BookingStatus } from "@prisma/client";
import { showToast } from "./Toast";
import {
  saveBookingStage,
  recordBookingPayment,
  recordSupplierPayout,
  setBookingCollector,
  saveProviderExtra,
  setSupplierPayable,
  addBookingNote,
  deleteBooking,
  saveBookingSurcharge,
  deletePayoutProof,
  type BookingActionState,
} from "@/app/admin/bookings/actions";
import { SURCHARGE_PRESETS, type BookingSurcharge } from "@/lib/surcharges";

/** Hiện toast theo kết quả server action {ok,error,message}. */
function useResultToast(state: BookingActionState, onOk?: () => void) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.ok) {
      showToast(state.message || "Đã lưu", "ok");
      onOk?.();
    } else if (state.error && !state.needConfirm) showToast(state.error, "error"); // needConfirm: form tự hỏi lại
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
  onDone,
}: {
  id: string;
  status: BookingStatus;
  cancelReason: string | null;
  /** Gọi sau khi lưu thành công (popup sửa nhanh nạp lại số liệu). */
  onDone?: () => void;
}) {
  const [picked, setPicked] = useState<BookingStatus>(status);
  const [state, action, pending] = useActionState<BookingActionState, FormData>(saveBookingStage, {});
  useResultToast(state, onDone);
  // Phòng của đơn đang bị khoá (đơn khác / sheet / khoá tay): hiện cảnh báo tình trạng hiện tại,
  // admin đồng ý thì gửi lại kèm force=1 để ghi đè.
  const asked = useRef(state);
  useEffect(() => {
    if (state === asked.current) return;
    asked.current = state;
    if (!state.needConfirm) return;
    if (!confirm(state.error || "Phòng đang bị khoá. Vẫn ghi đè?")) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", picked);
    fd.set("force", "1");
    startTransition(() => action(fd));
  }, [state, action, id, picked]);
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
  onDone,
}: {
  id: string;
  price: number | null;
  collected: number;
  onDone?: () => void;
}) {
  const [amt, setAmt] = useState("");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(recordBookingPayment, {});
  useResultToast(state, () => {
    setAmt("");
    onDone?.();
  });
  const fmt = (n: number) => n.toLocaleString("vi-VN");
  const due = price != null ? Math.max(0, price - collected) : null;
  const quick: [string, number][] = [
    ["Cọc 500k", 500000],
    ...(price != null && price > 0
      ? ([["Cọc 30%", Math.round(price * 0.3)], ["50%", Math.round(price * 0.5)], ["100%", price]] as [string, number][])
      : []),
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

/** Ghi nhận SÀN trả tiền cho một nhà cung cấp trong đơn (homestay / nhà xe). */
export function SupplierPayoutForm({
  id,
  side,
  label,
  payable,
  paid,
  onDone,
}: {
  id: string;
  side: "room" | "bus";
  label: string;
  payable: number;
  paid: number;
  onDone?: () => void;
}) {
  const [amt, setAmt] = useState("");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(recordSupplierPayout, {});
  useResultToast(state, () => {
    setAmt("");
    onDone?.();
  });
  const fmt = (n: number) => n.toLocaleString("vi-VN");
  const remaining = Math.max(0, payable - paid);
  const quick: [string, number][] =
    // Điền nhanh theo số PHẢI TRẢ; đã trả một phần thì không vượt quá phần còn lại.
    remaining > 0 ? [["50%", Math.min(remaining, Math.round(payable * 0.5))], ["100%", Math.min(remaining, payable)]] : [];

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="label" value={label} />
      {remaining > 0 && (
        <div className="flex gap-1.5">
          <input
            name="amount"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            inputMode="numeric"
            placeholder="Số tiền đã trả"
            className="w-full min-w-0 flex-1 rounded-lg border-[1.5px] border-gray-200 bg-white px-3 py-1.5 text-sm font-bold"
          />
          {quick.map(([name, v]) => (
            <button
              key={name}
              type="button"
              onClick={() => setAmt(fmt(v))}
              className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {remaining > 0 && (
          <>
            <button
              name="mode"
              value="add"
              disabled={pending}
              className="flex-1 rounded-full bg-forest-700 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-forest-800 disabled:opacity-50"
            >
              Ghi nhận đã trả
            </button>
            <button
              name="mode"
              value="full"
              disabled={pending}
              className="flex-1 rounded-full border-[1.5px] border-gray-200 bg-white px-3 py-1.5 text-[13px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Trả đủ
            </button>
          </>
        )}
        {paid > 0 && (
          <button
            name="mode"
            value="reset"
            disabled={pending}
            onClick={(e) => {
              if (!confirm(`Đặt lại số tiền đã trả cho ${label} về 0?`)) e.preventDefault();
            }}
            className="ml-auto whitespace-nowrap px-1 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Đặt lại về 0
          </button>
        )}
      </div>
    </form>
  );
}

/** Ô ghi chú nội bộ + chip ghi chú nhanh. */
/**
 * Sửa tay SỐ PHẢI TRẢ cho nhà cung cấp (khi hệ thống tính chưa đúng). Mặc định hệ thống tự tính;
 * đã sửa tay thì hiện nhãn + nút quay về số hệ thống tính.
 */
export function SupplierPayableForm({
  id,
  side,
  label,
  payable,
  autoPayable,
  overridden,
  onDone,
}: {
  id: string;
  side: "room" | "bus";
  label: string;
  payable: number;
  autoPayable: number;
  overridden: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(setSupplierPayable, {});
  useResultToast(state, () => {
    setOpen(false);
    setAmt("");
    onDone?.();
  });
  const fmt = (n: number) => n.toLocaleString("vi-VN");

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="label" value={label} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {overridden ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">Phải trả: đã sửa tay · hệ thống tính {fmt(autoPayable)}đ</span>
        ) : (
          <span className="text-gray-500">Phải trả: hệ thống tự tính</span>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setAmt(fmt(payable));
          }}
          className="font-bold text-forest-700 hover:underline"
        >
          {open ? "Đóng" : "✎ Sửa số phải trả"}
        </button>
        {overridden && (
          <button name="mode" value="auto" disabled={pending} className="font-bold text-gray-600 hover:underline disabled:opacity-50">
            Về số hệ thống tính
          </button>
        )}
      </div>
      {open && (
        <div className="flex gap-1.5">
          <input
            name="amount"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            inputMode="numeric"
            placeholder="Số tiền phải trả"
            className="w-full min-w-0 flex-1 rounded-lg border-[1.5px] border-amber-300 bg-white px-3 py-1.5 text-sm font-bold"
          />
          <button name="mode" value="set" disabled={pending} className="whitespace-nowrap rounded-full bg-amber-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-amber-700 disabled:opacity-50">
            Lưu số phải trả
          </button>
        </div>
      )}
    </form>
  );
}

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

/**
 * PHỤ THU của đơn: danh sách khoản (xoá được) + form thêm. Tổng đơn đã gồm phụ thu,
 * server cộng/trừ thẳng vào giá đơn (combo: vào phần tiền của bên được chọn).
 */
export function SurchargePanel({
  id,
  items,
  isCombo,
  basePrice,
}: {
  id: string;
  items: BookingSurcharge[];
  isCombo: boolean;
  /** Giá trước phụ thu (null = chưa có giá). */
  basePrice: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amt, setAmt] = useState("");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(saveBookingSurcharge, {});
  useResultToast(state, () => {
    setLabel("");
    setAmt("");
    setOpen(false);
  });
  const [delState, delAction, delPending] = useActionState<BookingActionState, FormData>(saveBookingSurcharge, {});
  useResultToast(delState);
  const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3.5 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink">Phụ thu</span>
        {!open && basePrice == null && <span className="text-xs text-gray-400">Nhập giá đơn trước khi thêm phụ thu</span>}
        {!open && basePrice != null && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            + Thêm phụ thu
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          {basePrice != null && (
            <div className="flex justify-between text-gray-500">
              <span>Giá đặt</span>
              <span>{fmt(basePrice)}</span>
            </div>
          )}
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-gray-700">
                {s.label}
                {isCombo && (
                  <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">
                    {s.side === "bus" ? "Nhà xe" : s.side === "extra" ? "Dịch vụ thêm" : "Homestay"}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-ink">+{fmt(s.amount)}</span>
                <form
                  action={delAction}
                  onSubmit={(e) => {
                    if (!confirm(`Xoá phụ thu "${s.label}"?`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="op" value="remove" />
                  <input type="hidden" name="sid" value={s.id} />
                  <button
                    disabled={delPending}
                    title="Xoá phụ thu"
                    className="rounded-full px-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </form>
              </span>
            </div>
          ))}
        </div>
      )}
      {items.length === 0 && !open && <p className="text-[13px] text-gray-400">Chưa có phụ thu.</p>}

      {open && (
        <form action={action} className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value="add" />
          <div className="flex flex-wrap gap-1.5">
            {SURCHARGE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLabel(p)}
                className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nội dung, VD: Thêm 1 người lớn"
              className="min-w-0 flex-1 rounded-lg border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <input
              name="amount"
              value={amt}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "");
                setAmt(d ? Number(d).toLocaleString("vi-VN") : "");
              }}
              inputMode="numeric"
              placeholder="Số tiền"
              className="rounded-lg border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm font-bold sm:w-36"
            />
            {isCombo && (
              <select name="side" defaultValue="room" className="rounded-lg border-[1.5px] border-gray-200 bg-white px-2 py-2 text-[13px] font-semibold">
                <option value="room">Homestay</option>
                <option value="bus">Nhà xe</option>
              </select>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              disabled={pending || !amt}
              className="flex-1 rounded-full bg-forest-700 px-3 py-2 text-sm font-bold text-white hover:bg-forest-800 disabled:opacity-50"
            >
              Thêm vào đơn
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border-[1.5px] border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
            >
              Huỷ
            </button>
          </div>
        </form>
      )}
    </div>
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

/** Admin chọn AI THU TIỀN KHÁCH của đơn: sàn thu (mặc định) hay chủ dịch vụ thu. */
export function CollectorForm({ id, collector, onDone }: { id: string; collector: "PLATFORM" | "PROVIDER"; onDone?: () => void }) {
  const [state, action, pending] = useActionState<BookingActionState, FormData>(setBookingCollector, {});
  useResultToast(state, onDone);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-[12px] font-semibold text-gray-600">Thu tiền khách:</span>
      <select key={collector} name="collector" defaultValue={collector} disabled={pending} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[13px] font-semibold text-ink">
        <option value="PLATFORM">Sàn thu (chuyển chủ dịch vụ phần thực nhận)</option>
        <option value="PROVIDER">Chủ dịch vụ thu (chuyển lại sàn chiết khấu)</option>
      </select>
      <button disabled={pending} className="rounded-lg bg-forest-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-forest-700 disabled:opacity-60">Lưu</button>
    </form>
  );
}

/** Chủ dịch vụ (hoặc admin) nhập tiền THU THÊM của khách ở đơn (vd trả xe quá giờ). 0 = xoá. */
export function ProviderExtraForm({ id, extra, onDone }: { id: string; extra: number; onDone?: () => void }) {
  const [amt, setAmt] = useState(extra > 0 ? String(extra) : "");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(saveProviderExtra, {});
  useResultToast(state, onDone);
  const shown = amt ? Number(amt).toLocaleString("vi-VN") : "";
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="amount" value={amt || "0"} />
      <label className="flex min-w-[160px] flex-1 flex-col gap-1">
        <span className="text-[12px] font-semibold text-gray-600">Tiền thu thêm của khách (đ)</span>
        <input
          inputMode="numeric"
          value={shown}
          onChange={(e) => setAmt(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder="VD: 140.000 (quá giờ)"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-ink"
        />
      </label>
      <button disabled={pending} className="rounded-lg bg-forest-600 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-forest-700 disabled:opacity-60">
        {pending ? "Đang lưu…" : extra > 0 ? "Cập nhật" : "Lưu"}
      </button>
    </form>
  );
}

export interface PayoutProofItem {
  id: string;
  url: string;
  createdAt: string; // ISO
  createdBy: string | null;
}

/**
 * Ảnh UỶ NHIỆM CHI khi sàn trả tiền cho nhà cung cấp (một bên room | bus của đơn).
 * Tải nhiều ảnh, nhiều lần (mỗi lần chuyển khoản một ảnh); bấm ảnh để xem lớn; × để xoá ảnh tải nhầm.
 */
export function PayoutProofs({
  id,
  side,
  proofs: initial,
  onDone,
}: {
  id: string;
  side: "room" | "bus";
  proofs: PayoutProofItem[];
  onDone?: () => void;
}) {
  const [proofs, setProofs] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setProofs(initial);
  }
  const [busy, setBusy] = useState(0); // số ảnh đang tải
  const [view, setView] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    const list = files ? [...files] : [];
    if (!list.length) return;
    let ok = 0;
    for (const f of list) {
      setBusy((n) => n + 1);
      try {
        const fd = new FormData();
        fd.set("bookingId", id);
        fd.set("side", side);
        fd.set("file", f);
        const r = await fetch("/api/admin/bookings/payout-proof", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) showToast(j.error || `Không tải được ${f.name}`, "error");
        else {
          ok++;
          setProofs((p) => [...p, j.proof as PayoutProofItem]);
        }
      } catch {
        showToast(`Lỗi kết nối khi tải ${f.name}`, "error");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    if (ok) {
      showToast(ok > 1 ? `Đã tải ${ok} ảnh uỷ nhiệm chi` : "Đã tải ảnh uỷ nhiệm chi", "ok");
      onDone?.();
    }
  }

  async function remove(p: PayoutProofItem) {
    if (!confirm("Xoá ảnh uỷ nhiệm chi này? (Số tiền đã trả không đổi)")) return;
    const res = await deletePayoutProof(p.id);
    if (res.error) return showToast(res.error, "error");
    setProofs((list) => list.filter((x) => x.id !== p.id));
    showToast(res.message || "Đã xoá ảnh", "ok");
    onDone?.();
  }

  const when = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-gray-600">
          Ảnh uỷ nhiệm chi{proofs.length ? ` (${proofs.length})` : ""}
        </span>
        <label className={`cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-forest-200 bg-white px-2.5 py-1 text-xs font-bold text-forest-700 hover:bg-forest-50 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? `Đang tải ${busy} ảnh…` : "📎 Tải ảnh"}
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
        </label>
      </div>
      {proofs.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
          {proofs.map((p) => (
            <div key={p.id} className="group relative">
              <button type="button" onClick={() => setView(p.url)} className="block aspect-square w-full overflow-hidden rounded-md bg-white ring-1 ring-black/10" title={`${when(p.createdAt)}${p.createdBy ? " · " + p.createdBy : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="Uỷ nhiệm chi" className="h-full w-full object-cover" loading="lazy" />
              </button>
              <button
                type="button"
                onClick={() => void remove(p)}
                aria-label="Xoá ảnh"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold leading-none text-white shadow"
              >
                ×
              </button>
              <div className="mt-0.5 truncate text-center text-[10px] text-gray-500">{when(p.createdAt).slice(6)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">Chưa có ảnh. Chuyển khoản xong thì tải ảnh uỷ nhiệm chi lên để lưu chứng từ — chọn được nhiều ảnh.</p>
      )}
      {view && (
        <div onClick={() => setView(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view} alt="Uỷ nhiệm chi" className="max-h-full max-w-full rounded-lg object-contain" />
          <a href={view} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink">
            Mở ảnh gốc ↗
          </a>
        </div>
      )}
    </div>
  );
}
