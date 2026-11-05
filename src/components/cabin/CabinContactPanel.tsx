import { formatPrice } from "@/lib/format";
import type { CabinFareOption } from "@/lib/cabin";

interface Props {
  operatorName: string;
  phone: string;
  zalo?: string | null;
  fares: CabinFareOption[];
  roundTrip: boolean;
}

/**
 * Panel cho nhà xe cabin "chỉ nhắn tin" (`Service.contactOnly`): KHÔNG cho đặt trước
 * trên web — khách nhắn Zalo (hoặc gọi) để kiểm tra chỗ và giữ vé.
 */
export function CabinContactPanel({ operatorName, phone, zalo, fares, roundTrip }: Props) {
  const chatUrl = zalo ? `https://zalo.me/${zalo}` : `tel:${phone.replace(/\s/g, "")}`;
  const ext = zalo ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const shown = fares.slice(0, 8);
  return (
    <>
      <aside className="lg:sticky lg:top-20">
        <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-md ring-1 ring-black/5">
          <div className="text-lg font-extrabold text-ink">Nhắn tin để đặt vé</div>
          <p className="text-sm leading-relaxed text-gray-600">
            <b>{operatorName}</b> không nhận đặt trước trên web. Nhắn Zalo cho Tà Xùa Booking để kiểm tra
            chỗ trống, nhận giá chính xác và giữ vé.
          </p>
          {shown.length > 0 && (
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                Giá tham khảo/khách ({roundTrip ? "khứ hồi" : "1 chiều"}, nằm ghép)
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {shown.map((f) => (
                  <li key={f.origin} className="flex justify-between gap-2">
                    <span className="text-gray-600">Từ {f.origin}</span>
                    <b className="text-ink">{formatPrice(f.fare)}</b>
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 text-xs text-gray-500">Cabin đôi: 2 người 1 buồng · Cabin đơn: 1 người 1 buồng (×2 giá)</div>
            </div>
          )}
          <a
            href={chatUrl}
            {...ext}
            className="rounded-xl bg-sunset-500 px-4 py-3.5 text-center text-base font-bold text-white transition hover:bg-sunset-600"
          >
            💬 Nhắn Zalo đặt vé
          </a>
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="rounded-xl border border-gray-200 px-4 py-3 text-center text-sm font-bold text-ink hover:bg-gray-50"
          >
            📞 Gọi {phone}
          </a>
        </div>
      </aside>

      {/* Thanh đáy dính (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)] lg:hidden">
        <div className="min-w-0">
          <div className="truncate text-xs text-gray-500">Kiểm tra chỗ & giữ vé</div>
          <div className="text-base font-extrabold text-ink">Nhắn tin đặt vé</div>
        </div>
        <a href={chatUrl} {...ext} className="whitespace-nowrap rounded-xl bg-sunset-500 px-5 py-3 text-sm font-bold text-white">
          💬 Nhắn Zalo
        </a>
      </div>
    </>
  );
}
