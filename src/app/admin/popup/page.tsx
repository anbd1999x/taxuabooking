import { getSettings } from "@/lib/queries";
import { parseTrustPopup, TRUST_POPUP_KEY } from "@/lib/trust-popup";
import { ActionForm } from "@/components/admin/ActionForm";
import { AvatarPicker } from "@/components/admin/AvatarPicker";
import { SITE } from "@/lib/site";
import { checkSmtp, saveLegalInfo, saveSmtpConfig, saveTrustPopup, sendDraftEmail, sendTestEmail } from "./actions";
import { getMailLastResult, getSmtpView } from "@/lib/mail";
import { vnDateTime } from "@/lib/date-format";

export const dynamic = "force-dynamic";

export default async function AdminPopupPage() {
  const settings = await getSettings();
  const [smtp, mailLast] = await Promise.all([getSmtpView(), getMailLastResult()]);
  const mailReady = smtp.hasPass;
  const config = parseTrustPopup(settings[TRUST_POPUP_KEY]);
  // SĐT toàn web: theo lựa chọn đã lưu; chưa lưu thì chọn sẵn người có số trùng số đang dùng.
  const cur = (settings.contactPhone || "").replace(/\D/g, "");
  const match = config.people.findIndex((p) => p.phone.replace(/\D/g, "") === cur);
  const phoneOwner = config.sitePhoneOwner ?? (match >= 0 ? match : 1);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Popup uy tín</h1>
        <p className="mt-1 text-sm text-gray-500">
          Popup hiện khi khách mới vào web (mỗi phiên 1 lần — chuyển trang không hiện lại, đóng
          trình duyệt rồi quay lại sẽ hiện lại). Cấu hình thông tin 2 chủ sở hữu dưới đây: ẩn/hiện từng người, và chọn
          số điện thoại của một người để dùng cho toàn bộ trang web (chân trang, nút gọi, Zalo, trang liên hệ…).
        </p>
      </header>

      <ActionForm action={saveTrustPopup} className="flex flex-col gap-5" success="Đã lưu popup uy tín.">
        <label className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={config.enabled}
            className="mt-0.5 h-4 w-4 accent-forest-600"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Hiện popup uy tín</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Popup hiện khi khách mới vào web. Bỏ tick để không hiện popup nữa.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <input
            type="checkbox"
            name="showLinks"
            defaultChecked={config.showLinks}
            className="mt-0.5 h-4 w-4 accent-forest-600"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Hiện menu và link cam kết</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Mục “Cam kết” trên thanh menu và link “Xem cam kết uy tín” dưới các form đặt dịch vụ. Tắt cả hai công tắc
              thì trang /cam-ket và trang điều khoản cũng ẩn luôn.
            </span>
          </span>
        </label>

        {[1, 2].map((i) => {
          const p = config.people[i - 1];
          return (
            <div key={i} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 className="text-sm font-bold text-ink">Chủ sở hữu {i}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-gray-700">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name={`show${i}`} defaultChecked={!p.hidden} className="h-4 w-4 accent-forest-600" />
                    Hiện người này trên web
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="sitePhone" value={i} defaultChecked={phoneOwner === i - 1} className="h-4 w-4 accent-forest-600" />
                    Dùng SĐT này cho toàn bộ trang web
                  </label>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-[13px] font-semibold text-gray-600">Ảnh đại diện</span>
                <AvatarPicker name={`avatar${i}`} initial={p.avatar} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-gray-600">Tên hiển thị</span>
                  <input
                    name={`name${i}`}
                    defaultValue={p.name}
                    placeholder="VD: Bùi An"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-gray-600">Số điện thoại</span>
                  <input
                    name={`phone${i}`}
                    defaultValue={p.phone}
                    placeholder="VD: 0397 943 155"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-gray-600">Link Facebook</span>
                  <input
                    name={`facebook${i}`}
                    defaultValue={p.facebook}
                    placeholder="https://facebook.com/..."
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-gray-600">
                    Link Zalo <span className="font-normal text-gray-400">(để trống sẽ tự dùng SĐT)</span>
                  </span>
                  <input
                    name={`zalo${i}`}
                    defaultValue={p.zalo}
                    placeholder="https://zalo.me/..."
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-bold text-ink">Cam kết "{config.fiveRules.length} Không"</h2>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-gray-500">Mỗi dòng là 1 điều cam kết (sẽ được đánh số tự động).</span>
            <textarea
              name="fiveRules"
              defaultValue={config.fiveRules.join("\n")}
              rows={6}
              placeholder={"Không đội giá\nKhông phụ thu ẩn\nKhông bỏ khách giữa đường\nKhông cọc mất trắng\nKhông thái độ với khách"}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm leading-relaxed"
            />
          </label>
        </div>

        <button className="w-fit rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
          Lưu cấu hình
        </button>
      </ActionForm>

      <ActionForm action={saveLegalInfo} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5" success="Đã lưu thông tin pháp lý.">
        <div>
          <h2 className="text-sm font-bold text-ink">Thông tin pháp lý</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Hiện ở chân trang, trang Giới thiệu, Liên hệ và mục “Bên cam kết” của điều khoản. Nên khớp với hồ sơ
            thanh toán / xác minh nhà quảng cáo trên Google Ads.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["legalName", "Tên đơn vị kinh doanh", settings.legalName || SITE.legalName, "text"],
              ["taxCode", "Mã số thuế", settings.taxCode || SITE.taxCode, "text"],
              ["legalAddress", "Địa chỉ đăng ký", settings.legalAddress || SITE.legalAddress, "text"],
            ] as const
          ).map(([name, label, value, type]) => (
            <label key={name} className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-gray-600">{label}</span>
              <input name={name} type={type} defaultValue={value} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
          ))}
        </div>
        <button className="w-fit rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
          Lưu thông tin pháp lý
        </button>
      </ActionForm>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div>
          <h2 className="text-sm font-bold text-ink">Máy chủ gửi email (SMTP)</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Cấu hình hộp thư dùng để gửi email cho khách. Lưu xong có hiệu lực ngay, không cần sửa máy chủ. Trạng thái:{" "}
            <b className={mailReady ? "text-forest-700" : "text-red-600"}>{mailReady ? "đã có mật khẩu" : "CHƯA có mật khẩu — web chưa gửi email"}</b>.
          </p>
        </div>

        <ActionForm action={saveSmtpConfig} className="flex flex-col gap-3" success="Đã lưu cấu hình máy chủ thư.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-gray-600">Máy chủ SMTP</span>
              <input name="smtpHost" defaultValue={smtp.host} placeholder="mail9234.maychuemail.com" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-gray-600">
                Cổng <span className="font-normal text-gray-400">(đang dùng {smtp.secure ? "SSL/TLS" : "STARTTLS"})</span>
              </span>
              {/* Kiểu bảo mật tự suy ra từ cổng để không thể chọn lệch (587 + SSL/TLS = không gửi được). */}
              {/* key theo giá trị đã lưu: React không cập nhật defaultValue của <select> sau lần dựng đầu, nên
                  lưu xong form tự reset về giá trị CŨ (trông như "không lưu được") — đổi key để dựng lại. */}
              <select key={`port-${smtp.port}`} name="smtpPort" defaultValue={smtp.port === 465 ? "465" : "587"} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <option value="587">587 — STARTTLS (khuyên dùng)</option>
                <option value="465">465 — SSL/TLS</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-gray-600">Tên đăng nhập (email đầy đủ)</span>
              <input name="smtpUser" defaultValue={smtp.user} placeholder="lienhe@taxuabooking.com" autoComplete="off" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-gray-600">
                Mật khẩu hộp thư {mailReady && <span className="font-normal text-forest-700">(đã lưu — để trống nếu không đổi)</span>}
              </span>
              <input name="smtpPass" type="password" autoComplete="new-password" placeholder={mailReady ? "••••••••" : "Nhập mật khẩu"} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[13px] font-semibold text-gray-600">Tên người gửi (From)</span>
              <input name="mailFrom" defaultValue={smtp.from} placeholder="Tà Xùa Booking <lienhe@taxuabooking.com>" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
          </div>
          <button className="w-fit rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
            Lưu cấu hình
          </button>
        </ActionForm>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
          <div className="text-[13px] font-semibold text-gray-600">Kiểm tra</div>
          <div className="flex flex-wrap items-end gap-3">
            <ActionForm action={checkSmtp} success="Kết nối thành công.">
              <button className="rounded-xl border-[1.5px] border-forest-600 bg-white px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Kiểm tra kết nối
              </button>
            </ActionForm>
            <ActionForm action={sendDraftEmail} className="flex flex-1 flex-wrap items-end gap-2" success="Đã gửi thư nháp.">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1">
                <span className="text-[13px] text-gray-500">Gửi thư nháp tới</span>
                <input name="to" type="email" placeholder="email@cuaban.com" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <button className="rounded-xl border-[1.5px] border-forest-600 bg-white px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Gửi thư nháp
              </button>
            </ActionForm>
          </div>
          <p className="text-xs text-gray-500">
            “Kiểm tra kết nối” thử đăng nhập máy chủ thư bằng cấu hình <b>đã lưu</b> (lưu trước rồi mới kiểm tra). Kết quả hiện ở thông báo
            góc màn hình.
          </p>
          {mailLast && (
            <div className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${mailLast.ok ? "bg-forest-50 text-forest-800" : "bg-red-50 text-red-700"}`}>
              <b>Lần gửi gần nhất: {mailLast.ok ? "thành công" : "THẤT BẠI"}</b> · {vnDateTime(mailLast.at)} · tới {mailLast.to}
              <div className="text-gray-600">{mailLast.subject}</div>
              {!mailLast.ok && mailLast.error && <div className="mt-1 break-words font-medium">{mailLast.error}</div>}
            </div>
          )}
        </div>
      </section>

      <ActionForm action={sendTestEmail} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5" success="Đã gửi thư thử.">
        <div>
          <h2 className="text-sm font-bold text-ink">Email gửi khách</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Khách điền email khi đặt sẽ nhận thư “đã nhận yêu cầu”, và thư “xác nhận” khi đơn chuyển sang Đã xác nhận.
            Trạng thái SMTP:{" "}
            <b className={mailReady ? "text-forest-700" : "text-red-600"}>{mailReady ? "đã có mật khẩu" : "CHƯA có mật khẩu hộp thư — web chưa gửi email"}</b>.
            Xem trước mẫu thư:{" "}
            <a href="/api/admin/email-preview?kind=received" target="_blank" className="font-semibold text-forest-700 underline">đã nhận yêu cầu</a>
            {" · "}
            <a href="/api/admin/email-preview?kind=confirmed" target="_blank" className="font-semibold text-forest-700 underline">xác nhận</a>.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-gray-600">Gửi thử tới</span>
            <input name="to" type="email" placeholder="email@cuaban.com" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-gray-600">Mã đơn mẫu <span className="font-normal text-gray-400">(trống = đơn mới nhất)</span></span>
            <input name="code" placeholder="TX-XXXXXX" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-gray-600">Loại thư</span>
            <select name="kind" className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="received">Đã nhận yêu cầu</option>
              <option value="confirmed">Xác nhận đơn</option>
              <option value="cancelled">Huỷ đơn</option>
            </select>
          </label>
        </div>
        <button className="w-fit rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
          Gửi thư thử
        </button>
      </ActionForm>
    </div>
  );
}
