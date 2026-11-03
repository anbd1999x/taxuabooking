export interface CabinPriceRow {
  id: string;
  pickupPoint: string;
  destination: string;
  price: number | null;
  note: string | null;
}

/** "500000" -> {num:"500", unit:"k"} để hiển thị số lớn + đơn vị nhỏ như poster. */
function kParts(n: number | null): { num: string; unit: string } {
  if (n == null) return { num: "LH", unit: "" };
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return { num: (Number.isInteger(v) ? v : v.toFixed(1)).toString(), unit: "tr" };
  }
  return { num: Math.round(n / 1000).toString(), unit: "k" };
}

function Price({ n, className }: { n: number | null; className?: string }) {
  const { num, unit } = kParts(n);
  return (
    <span className={className}>
      {num}
      <span className="text-[0.6em] font-bold align-baseline">{unit}</span>
    </span>
  );
}

export function CabinPriceTable({
  rows,
  settings,
}: {
  rows: CabinPriceRow[];
  settings: Record<string, string>;
}) {
  if (rows.length === 0) return null;

  const subtitle = settings.cabinFareSubtitle || "Xuất phát 21:00 hằng tối";
  const comboTitle = settings.cabinComboTitle || "Xe + Home view kính trung tâm";
  const comboSub = settings.cabinComboSub || "Trọn gói 2 ngày 1 đêm";
  const comboPrice = Number(settings.cabinComboPrice || "700000");
  const comboNote = settings.cabinComboNote || "Giá từ Hà Nội · đã gồm vé xe & home view kính trung tâm";
  const homeFrom = Number(settings.cabinHomeFrom || "500000");
  const bikeFrom = Number(settings.cabinBikeFrom || "150000");
  const footnote = settings.cabinFareFootnote || "Giá có thể thay đổi theo thời điểm. Vui lòng liên hệ trước để giữ chỗ.";
  const tagline = settings.cabinTagline || "Đi xa không chỉ là khoảng cách, mà là những trải nghiệm đáng nhớ!";
  const phone = settings.contactPhone || "0357452952";

  const cream = "#f4f1e4";

  return (
    <section className="bg-forest-900 text-white">
      <div className="container-page py-12 sm:py-16">
        {/* Tiêu đề poster */}
        <div className="flex flex-col items-start gap-3">
          <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-forest-50 ring-1 ring-white/15">
            🚌 Xe cabin giường nằm · Khứ hồi
          </span>
          <h2 className="text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-6xl">
            Cabin Tà Xùa
          </h2>
          <p className="text-lg font-medium italic text-sunset-300">
            Đồng hành cùng bạn trên mọi nẻo đường
          </p>
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15">
            🕐 {subtitle}
          </span>
        </div>

        {/* Nội dung */}
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Bảng giá vé */}
          <div className="rounded-3xl p-6 text-forest-900 sm:p-8" style={{ background: cream }}>
            <div className="flex items-baseline justify-between border-b-2 border-forest-900/15 pb-3">
              <h3 className="text-2xl font-extrabold">Bảng giá vé</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-forest-700/70">Khứ hồi</span>
            </div>
            <ul>
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-forest-900/10 py-2.5 text-[17px]">
                  <span className="font-medium">{r.pickupPoint}</span>
                  <Price n={r.price} className="text-xl font-extrabold text-forest-800" />
                </li>
              ))}
            </ul>
          </div>

          {/* Combo + ưu đãi */}
          <div className="flex flex-col gap-4">
            {/* Combo */}
            <div className="rounded-3xl bg-sunset-500 p-6 text-white">
              <span className="inline-block rounded-full bg-forest-900/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                Combo khuyến mãi
              </span>
              <p className="mt-3 text-xl font-bold leading-snug">{comboTitle}</p>
              <p className="text-sm text-white/90">{comboSub}</p>
              <Price n={comboPrice} className="mt-1 block text-6xl font-extrabold leading-none" />
              <p className="mt-2 text-sm text-white/90">{comboNote}</p>
            </div>

            {/* Home lẻ */}
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
              <span className="text-2xl">🏠</span>
              <div>
                <p className="font-semibold leading-tight">Home lẻ · phòng view kính</p>
                <p className="text-sm text-forest-100">
                  Chỉ từ <Price n={homeFrom} className="text-xl font-extrabold text-sunset-300" />
                  <span className="text-forest-200">/đêm</span>
                </p>
              </div>
            </div>

            {/* Thuê xe máy */}
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
              <span className="text-2xl">🏍️</span>
              <div>
                <p className="font-semibold leading-tight">Thuê xe máy</p>
                <p className="text-sm">
                  <Price n={bikeFrom} className="text-xl font-extrabold text-sunset-300" />
                  <span className="text-forest-200">/ngày</span>
                </p>
              </div>
            </div>

            <p className="text-sm text-forest-200">{footnote}</p>
          </div>
        </div>

        {/* Hotline + tagline */}
        <div className="mt-6 flex flex-col items-center gap-4 rounded-3xl p-5 text-forest-900 sm:flex-row sm:justify-between sm:p-6" style={{ background: cream }}>
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-800 text-white">📞</span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-forest-700/70">Hotline đặt vé</span>
              <span className="text-2xl font-extrabold text-forest-900">{phone}</span>
            </span>
          </a>
          <p className="text-center text-sm font-medium italic text-forest-700 sm:text-right">{tagline}</p>
        </div>
        <p className="mt-3 text-center text-sm font-semibold uppercase tracking-[0.15em] text-forest-200">
          An toàn · Tiện lợi · Đúng giờ
        </p>
      </div>
    </section>
  );
}
