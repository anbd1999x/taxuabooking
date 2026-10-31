import type { Metadata } from "next";
import Link from "next/link";
import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCustomer, normalizePhone } from "@/lib/customer";
import { formatPrice, toNumber } from "@/lib/format";
import { toDateKey } from "@/lib/dates";
import { CustomerAuthForms } from "@/components/CustomerAuthForms";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tài khoản",
  robots: { index: false },
};

const STATUS: Record<BookingStatus, { label: string; bg: string; fg: string }> = {
  NEW: { label: "Mới · chờ xác nhận", bg: "#eff6ff", fg: "#1d4ed8" },
  CONTACTING: { label: "Đang liên hệ", bg: "#fffbeb", fg: "#b45309" },
  CONFIRMED: { label: "Đã xác nhận", bg: "#ecfdf5", fg: "#047857" },
  COMPLETED: { label: "Đã hoàn thành", bg: "#ecfdf5", fg: "#047857" },
  CANCELLED: { label: "Đã huỷ", bg: "#fef2f2", fg: "#b91c1c" },
};
const PAYMENT: Record<PaymentStatus, string> = { UNPAID: "Chưa thanh toán", PAID: "Đã thanh toán" };

function str(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}
function fmtD(d: Date | null): string {
  if (!d) return "";
  const [y, m, day] = toDateKey(d).split("-");
  return `${day}/${m}/${y}`;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = str(sp.next) || "/";
  const err = str(sp.err);
  const customer = await getCustomer();
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  // Ẩn tạm nút Facebook bằng cờ FACEBOOK_LOGIN_OFF=1 (không mất creds).
  const facebookEnabled = Boolean(process.env.FACEBOOK_APP_ID) && process.env.FACEBOOK_LOGIN_OFF !== "1";

  const phone = customer ? normalizePhone(customer.phone) : "";
  const bookings =
    customer && phone.length >= 8
      ? await prisma.bookingRequest.findMany({
          where: { phone },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

  if (!customer) {
    return (
      <div className="container-page py-10">
        <div className="mx-auto max-w-md">
          <header className="mb-5 text-center">
            <h1 className="text-2xl font-bold text-ink">Đăng nhập / Đăng ký</h1>
            <p className="mt-1 text-sm text-gray-500">Đăng nhập để xem đơn của bạn và đánh giá dịch vụ.</p>
          </header>
          {err && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              Đăng nhập mạng xã hội chưa thành công, vui lòng thử lại hoặc dùng số điện thoại.
            </p>
          )}
          <CustomerAuthForms next={next} googleEnabled={googleEnabled} facebookEnabled={facebookEnabled} />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        {/* Hồ sơ */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-100 text-lg font-bold text-forest-700">
              {customer.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-bold text-ink">{customer.name}</div>
              <div className="text-sm text-gray-500">{customer.phone || "Tài khoản mạng xã hội"}</div>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Đăng xuất
            </button>
          </form>
        </div>

        {/* Đơn của tôi */}
        <section className="mt-6">
          <h2 className="text-lg font-bold text-ink">Đơn của tôi</h2>
          {!phone ? (
            <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
              Tài khoản này chưa gắn số điện thoại nên chưa hiển thị được đơn. Bạn có thể tra cứu bằng SĐT tại{" "}
              <Link href="/tra-cuu" className="font-semibold text-forest-700">trang tra cứu</Link>.
            </div>
          ) : bookings.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              Chưa có đơn nào với số <b className="text-ink">{customer.phone}</b>.{" "}
              <Link href="/" className="font-semibold text-forest-700">Đặt dịch vụ ngay →</Link>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-gray-500"><b className="text-ink">{bookings.length}</b> đơn đã đặt</p>
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
                    <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm text-gray-600 sm:grid-cols-3">
                      <div><span className="text-gray-400">Ngày:</span> {fmtD(b.useDate)}{b.endDate ? ` → ${fmtD(b.endDate)}` : ""}</div>
                      <div><span className="text-gray-400">Số lượng:</span> {b.quantity}</div>
                      <div><span className="text-gray-400">Đặt lúc:</span> {fmtD(b.createdAt)}</div>
                    </div>
                    <div className="mt-2 border-t border-gray-100 pt-2 text-sm">
                      <span className="text-gray-400">Tạm tính:</span>{" "}
                      <b className="text-forest-700">{price != null ? formatPrice(price) : "Liên hệ"}</b>
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{PAYMENT[b.paymentStatus]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-6 text-center text-sm text-gray-500">
          <Link href="/" className="font-semibold text-forest-700">← Về trang chủ</Link>
        </div>
      </div>
    </div>
  );
}
