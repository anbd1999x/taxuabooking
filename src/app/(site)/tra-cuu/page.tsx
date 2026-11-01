import type { Metadata } from "next";
import Link from "next/link";
import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice, toNumber } from "@/lib/format";
import { toDateKey } from "@/lib/dates";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tra cứu đơn đặt",
  description: "Tra cứu tình trạng đơn đặt dịch vụ Tà Xùa bằng số điện thoại hoặc mã đơn.",
  alternates: { canonical: "/tra-cuu" },
};

const STATUS: Record<BookingStatus, { label: string; bg: string; fg: string }> = {
  NEW: { label: "Mới · chờ xác nhận", bg: "#eff6ff", fg: "#1d4ed8" },
  CONTACTING: { label: "Đang liên hệ", bg: "#fffbeb", fg: "#b45309" },
  CONFIRMED: { label: "Đã xác nhận", bg: "#ecfdf5", fg: "#047857" },
  COMPLETED: { label: "Đã hoàn thành", bg: "#ecfdf5", fg: "#047857" },
  CANCELLED: { label: "Đã huỷ", bg: "#fef2f2", fg: "#b91c1c" },
};
const PAYMENT: Record<PaymentStatus, string> = { UNPAID: "Chưa thanh toán", DEPOSITED: "Đã cọc", PAID: "Đã thanh toán" };

function fmtD(d: Date | null): string {
  if (!d) return "";
  const [y, m, day] = toDateKey(d).split("-");
  return `${day}/${m}/${y}`;
}

function str(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim();
  const digits = q.replace(/\D/g, "");
  const code = q.toUpperCase();

  // Tra theo SĐT (đủ 9–11 số) hoặc theo mã đơn (TX-...). Tránh trả toàn bộ khi để trống.
  const bookings =
    q.length >= 4
      ? await prisma.bookingRequest.findMany({
          where: {
            OR: [
              ...(digits.length >= 8 ? [{ phone: digits }, { phone: { contains: digits } }] : []),
              { code },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [];

  const phone = SITE.defaultPhone;

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">Trang chủ</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">Tra cứu đơn</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Tra cứu đơn đặt</h1>
        <p className="mt-1 text-gray-500">Nhập số điện thoại đã đặt (hoặc mã đơn) để xem tình trạng.</p>
      </header>

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          inputMode="tel"
          placeholder="Số điện thoại hoặc mã đơn (VD: TX-ABC123)"
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
        />
        <button className="rounded-xl bg-forest-600 px-6 py-3 text-base font-bold text-white hover:bg-forest-700">
          Tra cứu
        </button>
      </form>

      <div className="mt-6">
        {q.length < 4 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
            Nhập số điện thoại hoặc mã đơn rồi bấm “Tra cứu”.
          </p>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="text-lg font-medium text-gray-700">Không tìm thấy đơn nào</p>
            <p className="mt-1 text-sm text-gray-500">
              Kiểm tra lại số điện thoại/mã đơn, hoặc gọi{" "}
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-forest-700">{phone}</a> để được hỗ trợ.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">Tìm thấy <b className="text-ink">{bookings.length}</b> đơn.</p>
            {bookings.map((b) => {
              const st = STATUS[b.status];
              const price = toNumber(b.referencePrice);
              return (
                <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Mã đơn</div>
                      <div className="text-lg font-extrabold text-ink">{b.code}</div>
                    </div>
                    <span className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold" style={{ background: st.bg, color: st.fg }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-2 text-[15px] font-bold text-ink">{b.serviceTitle}</div>
                  {b.selectionLabel && <div className="mt-0.5 text-sm text-gray-600">{b.selectionLabel}</div>}
                  <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
                    <div><span className="text-gray-400">Khách:</span> {b.customerName}</div>
                    <div><span className="text-gray-400">SĐT:</span> {b.phone}</div>
                    <div><span className="text-gray-400">Ngày:</span> {fmtD(b.useDate)}{b.endDate ? ` → ${fmtD(b.endDate)}` : ""}</div>
                    <div><span className="text-gray-400">Số lượng:</span> {b.quantity}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    <div className="text-sm">
                      <span className="text-gray-400">Tạm tính:</span>{" "}
                      <b className="text-forest-700">{price != null ? formatPrice(price) : "Liên hệ"}</b>
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{PAYMENT[b.paymentStatus]}</span>
                    </div>
                    <div className="text-xs text-gray-400">Đặt lúc {fmtD(b.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Cần hỗ trợ? Gọi <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-forest-700">{phone}</a> ·{" "}
        <Link href="/huong-dan" className="font-semibold text-forest-700">Xem hướng dẫn</Link>
      </p>
    </div>
  );
}
