import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng ký dùng miễn phí 4 chức năng quản lý",
  description: "Đăng nhập bằng Google là dùng ngay miễn phí 4 chức năng: quản lý homestay, quản lý thuê xe máy, bán vé & đặt bàn, gọi món QR tại bàn.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

/** 4 chức năng có sẵn ngay khi đăng nhập. */
const MODULES = [
  ["🏡", "Quản lý homestay", "Lịch phòng, đặt phòng, thu chi, buồng phòng, báo cáo."],
  ["🛵", "Quản lý thuê xe máy", "Đội xe, lượt thuê, giao / nhận xe, cọc, thu chi."],
  ["🎟️", "Bán vé & đặt bàn", "Vé cổng, show có sơ đồ ghế, đặt bàn, soát vé QR."],
  ["📱", "Gọi món QR tại bàn", "Thực đơn điện tử, khách quét QR gọi món, bếp nhận đơn."],
];

const STEPS = [
  ["Đăng nhập bằng Google", "Chọn tài khoản Gmail là vào — không cần điền form, không cần nhớ mật khẩu."],
  ["Có ngay 4 chức năng", "Vào là thấy đủ 4 chức năng ở menu. Dùng chức năng nào thì thiết lập chức năng đó."],
  ["Lên website khi sẵn sàng", "Homestay, điểm bán vé hiện cho khách đặt trên Tà Xùa Booking sau khi được duyệt."],
];

const ERRORS: Record<string, string> = {
  google_off: "Đăng nhập Google đang tạm tắt. Vui lòng liên hệ Tà Xùa Booking qua Zalo.",
  email: "Tài khoản Google này chưa có email đã xác minh — hãy chọn tài khoản khác.",
  locked: "Tài khoản này đã bị khoá. Vui lòng liên hệ Tà Xùa Booking.",
};

export default async function PartnerTrialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const err = (await searchParams).err;
  const errCode = Array.isArray(err) ? err[0] : err;
  const errMsg = errCode ? ERRORS[errCode] ?? "Đăng nhập Google chưa thành công, vui lòng thử lại." : null;
  const googleOn = Boolean(process.env.GOOGLE_CLIENT_ID);

  return (
    <div className="bg-gradient-to-b from-forest-50 to-white">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_400px] md:items-center md:py-16">
        <div>
          <a href="/hop-tac" className="text-sm font-semibold text-forest-700 hover:underline">← Hợp tác</a>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">Đăng ký dùng miễn phí 4 chức năng quản lý</h1>
          <p className="mt-3 text-base text-gray-600">Dành cho chủ homestay, tiệm xe máy, điểm du lịch và nhà hàng ở Tà Xùa. Một tài khoản dùng được cả 4 chức năng; lần sau đăng nhập lại vẫn thấy đủ dữ liệu.</p>
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {MODULES.map(([icon, t, d]) => (
              <div key={t} className="flex gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-forest-50 text-xl" aria-hidden>{icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-ink">{t}</div>
                  <div className="text-xs leading-relaxed text-gray-600">{d}</div>
                </div>
              </div>
            ))}
          </div>
          <ol className="mt-6 space-y-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-forest-600 text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <div className="font-bold text-ink">{t}</div>
                  <div className="text-sm text-gray-600">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 md:p-7">
          <h2 className="text-xl font-bold text-ink">Đăng ký miễn phí</h2>
          <p className="mt-1 text-sm text-gray-500">Lần đầu đăng nhập, hệ thống tự tạo tài khoản có sẵn 4 chức năng cho bạn.</p>
          {errMsg && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errMsg}</p>}
          {googleOn ? (
            // <a> (không <Link>): tránh prefetch route OAuth.
            <a
              href="/api/auth/google?mode=partner"
              rel="nofollow"
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-[15px] font-bold text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Tiếp tục với Google
            </a>
          ) : (
            <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{ERRORS.google_off}</p>
          )}
          <p className="mt-5 text-xs leading-relaxed text-gray-400">
            Miễn phí, không thu phí theo đơn. Homestay / điểm bán vé bạn tạo sẽ hiện trên website sau khi Tà Xùa Booking duyệt — việc duyệt không ảnh hưởng các chức năng quản lý, bạn dùng được ngay.
          </p>
          <p className="mt-4 border-t border-gray-100 pt-4 text-center text-sm text-gray-500">
            Đã có tài khoản do Tà Xùa Booking cấp? <a href="/admin/login" className="font-semibold text-forest-700 hover:underline">Đăng nhập</a>
          </p>
        </div>
      </div>
    </div>
  );
}
