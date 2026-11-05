import { getSettings } from "@/lib/queries";
import { parseTrustPopup, TRUST_POPUP_KEY } from "@/lib/trust-popup";
import { ActionForm } from "@/components/admin/ActionForm";
import { AvatarPicker } from "@/components/admin/AvatarPicker";
import { saveTrustPopup } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPopupPage() {
  const settings = await getSettings();
  const config = parseTrustPopup(settings[TRUST_POPUP_KEY]);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Popup uy tín</h1>
        <p className="mt-1 text-sm text-gray-500">
          Popup hiện khi khách mới vào web (mỗi phiên 1 lần — chuyển trang không hiện lại, đóng
          trình duyệt rồi quay lại sẽ hiện lại). Cấu hình thông tin 2 người đứng sau dưới đây.
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
            <span className="block text-sm font-semibold text-ink">Hiển thị popup trên trang web</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Bỏ tick để tắt hẳn popup (khách sẽ không thấy popup uy tín nữa).
            </span>
          </span>
        </label>

        {[1, 2].map((i) => {
          const p = config.people[i - 1];
          return (
            <div key={i} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="text-sm font-bold text-ink">Người {i}</h2>

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
    </div>
  );
}
