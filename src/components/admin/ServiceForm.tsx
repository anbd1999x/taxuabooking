"use client";

import { useActionState, useState } from "react";
import type { ServiceCategory } from "@prisma/client";
import { CATEGORY_LIST, AREA_OPTIONS } from "@/lib/constants";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type { ActionState } from "@/app/admin/services/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

interface Initial {
  id?: string;
  category?: ServiceCategory;
  title?: string;
  slug?: string;
  summary?: string;
  description?: string;
  area?: string | null;
  mapUrl?: string | null;
  policy?: string | null;
  basePrice?: number | null;
  originalPrice?: number | null;
  priceUnit?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactZalo?: string | null;
  featured?: boolean;
  published?: boolean;
  easyRoad?: boolean;
  pool?: boolean;
  ownerId?: string | null;
  ctvCommission?: number | null;
  weekendPolicy?: string | null;
}

const inputCls =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200";

export function ServiceForm({
  action,
  initial = {},
  submitLabel,
  providers = [],
}: {
  action: Action;
  initial?: Initial;
  submitLabel: string;
  providers?: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [cat, setCat] = useState<ServiceCategory>(initial.category ?? "HOMESTAY");
  // Homestay/bungalow chọn khu vực từ danh sách chuẩn; danh mục khác nhập tự do (tuyến đường...).
  const areaSelect = cat === "HOMESTAY" || cat === "BUNGALOW";
  const areaOptions =
    initial.area && !AREA_OPTIONS.includes(initial.area) ? [initial.area, ...AREA_OPTIONS] : AREA_OPTIONS;

  return (
    <form action={formAction} className="space-y-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Danh mục *</span>
          <select
            name="category"
            value={cat}
            onChange={(e) => setCat(e.target.value as ServiceCategory)}
            className={inputCls}
            required
          >
            {CATEGORY_LIST.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Đường dẫn (slug)</span>
          <input name="slug" defaultValue={initial.slug ?? ""} placeholder="Tự tạo nếu để trống" className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Tên dịch vụ *</span>
        <input name="title" defaultValue={initial.title ?? ""} className={inputCls} required />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Mô tả ngắn *</span>
        <input name="summary" defaultValue={initial.summary ?? ""} className={inputCls} required />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Mô tả chi tiết *</span>
        <textarea name="description" defaultValue={initial.description ?? ""} rows={5} className={inputCls} required />
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-600">{areaSelect ? "Khu vực" : "Khu vực / tuyến"}</span>
          {areaSelect ? (
            <select name="area" defaultValue={initial.area ?? ""} className={inputCls}>
              <option value="">— Chọn khu vực —</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          ) : (
            <input name="area" defaultValue={initial.area ?? ""} className={inputCls} />
          )}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Giá bán (đ)</span>
          <MoneyInput name="basePrice" defaultValue={initial.basePrice ?? ""} placeholder="Để trống = Liên hệ" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Giá gốc — gạch ngang (đ)</span>
          <MoneyInput name="originalPrice" defaultValue={initial.originalPrice ?? ""} placeholder="Để trống = không giảm giá" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Đơn vị giá</span>
          <input name="priceUnit" defaultValue={initial.priceUnit ?? ""} placeholder="/đêm, /vé..." className={inputCls} />
        </label>
      </div>
      <p className="-mt-3 text-xs text-gray-400">Nhập &quot;Giá gốc&quot; cao hơn &quot;Giá bán&quot; để web hiển thị giá gạch ngang kèm % giảm (khuyến mãi).</p>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Link Google Maps</span>
        <input
          name="mapUrl"
          defaultValue={initial.mapUrl ?? ""}
          placeholder="Dán link chia sẻ hoặc link nhúng Google Maps (để trống = tự tìm theo tên + khu vực)"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-gray-400">
          Mở Google Maps → Chia sẻ → sao chép liên kết (hoặc “Nhúng bản đồ”). Hiển thị bản đồ ở trang homestay.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Chính sách homestay</span>
        <textarea
          name="policy"
          defaultValue={initial.policy ?? ""}
          rows={5}
          placeholder="VD:&#10;- Nhận phòng từ 14:00, trả phòng trước 12:00&#10;- Huỷ miễn phí trước 3 ngày&#10;- Không hút thuốc trong phòng, giữ trật tự sau 22:00"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-gray-400">
          Mỗi dòng một mục. Hiển thị cho khách ở màn đặt phòng. Để trống nếu không có.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Người liên hệ</span>
          <input name="contactName" defaultValue={initial.contactName ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Điện thoại</span>
          <input name="contactPhone" defaultValue={initial.contactPhone ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Zalo</span>
          <input name="contactZalo" defaultValue={initial.contactZalo ?? ""} className={inputCls} />
        </label>
      </div>

      <label className="block sm:max-w-sm">
        <span className="text-sm font-medium text-gray-600">Chủ dịch vụ (nhà xe / homestay)</span>
        <select name="ownerId" defaultValue={initial.ownerId ?? ""} className={inputCls}>
          <option value="">— Chưa gán —</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gray-400">Dùng để chủ dịch vụ đăng nhập xem đơn & đối soát thanh toán.</span>
      </label>

      <label className="block sm:max-w-sm">
        <span className="text-sm font-medium text-gray-600">Hoa hồng CTV / đơn (đ)</span>
        <MoneyInput name="ctvCommission" defaultValue={initial.ctvCommission ?? ""} placeholder="Để trống = dùng mức mặc định của CTV" className={inputCls} />
        <span className="mt-1 block text-xs text-gray-400">Ghi đè mức hoa hồng cố định mỗi đơn CTV đặt cho dịch vụ này. Để trống = dùng mức mặc định của từng CTV.</span>
      </label>

      <label className="block sm:max-w-sm">
        <span className="text-sm font-medium text-gray-600">Chính sách bán cuối tuần (homestay)</span>
        <select name="weekendPolicy" defaultValue={initial.weekendPolicy ?? "NONE"} className={inputCls}>
          <option value="NONE">Bán lẻ từng đêm (bình thường)</option>
          <option value="FRI_SAT">Chỉ bán nguyên cụm T6 + T7</option>
          <option value="SAT_SUN">Chỉ bán nguyên cụm T7 + CN</option>
          <option value="FRI_SUN">Chỉ bán nguyên cụm T6 + T7 + CN</option>
        </select>
        <span className="mt-1 block text-xs text-gray-400">Cuối tuần chỉ nhận đặt nguyên cụm, không bán lẻ (vd không bán riêng đêm T7). Khách chọn ngày thiếu đêm trong cụm sẽ bị chặn.</span>
      </label>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={initial.published ?? true} className="accent-forest-600 h-4 w-4" />
          <span className="text-sm text-gray-700">Hiển thị trên website</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="featured" defaultChecked={initial.featured ?? false} className="accent-forest-600 h-4 w-4" />
          <span className="text-sm text-gray-700">Dịch vụ nổi bật</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="easyRoad" defaultChecked={initial.easyRoad ?? false} className="accent-forest-600 h-4 w-4" />
          <span className="text-sm text-gray-700">Đường dễ đi (lọc combo)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="pool" defaultChecked={initial.pool ?? false} className="accent-forest-600 h-4 w-4" />
          <span className="text-sm text-gray-700">🏊 Hồ bơi (lọc combo)</span>
        </label>
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-forest-50 px-3 py-2 text-sm text-forest-700">Đã lưu thành công.</p>}

      <button type="submit" disabled={pending} className="rounded-xl bg-forest-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
        {pending ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}
