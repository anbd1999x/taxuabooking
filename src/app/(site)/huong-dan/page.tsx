import Link from "@/components/Link";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { formatPhone } from "@/lib/trust-popup";
import { getT, lp } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";
import { CommitmentHeroLink } from "@/components/trust/CommitmentLink";
import { GuideSteps, type GuideStep } from "@/components/guide/GuideSteps";

export const dynamic = "force-dynamic";

export const generateMetadata = () => i18nMeta({
  title: "Hướng dẫn đặt dịch vụ",
  description: "6 bước đặt xe cabin, homestay, combo tại Tà Xùa Booking: chọn ngày, gửi yêu cầu, nhận mã đơn, được gọi tư vấn, kiểm chứng rồi mới cọc.",
  path: "/huong-dan",
});

// Biểu tượng nét (một path) — theo claude.ai/design `Huong dan Dat dich vu.dc.html`.
const I = {
  cal: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h3v3H8z",
  form: "M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 12h7M8.5 16h4",
  code: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  chatok: "M4 5h16v11H9l-5 4zM9 10.5l2 2 4-4",
  chat: "M4 5h16v11H9l-5 4zM8.5 10.5h7",
  bus: "M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 16v3M17 16v3M8 13.5h.01M16 13.5h.01",
  home: "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
  bike: "M2.5 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15.5 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.5 16h5l3.5-6h-4.5M13.5 6h3l2 7",
  combo: "M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10",
  car: "M5 15l1.5-5A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.9 1.5L19 15M4 15h16v4H4zM7 19v1.5M17 19v1.5M7.5 17h.01M16.5 17h.01",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8h.01",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  user: "M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4.5 20a7.5 7.5 0 0 1 15 0",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4",
  headset: "M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v6H5a1 1 0 0 1-1-1zM20 13h-3v6h2a1 1 0 0 0 1-1zM17 19c0 1.5-2 2-5 2",
};

function Ico({ d, size = 22, sw = 1.8 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const G = "oklch(0.29 0.055 160)";

export default async function GuidePage() {
  const tr = await getT();
  const settings = await getSettings();
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;
  const tel = phone.replace(/\s/g, "");

  // 4 trạng thái đơn (dùng ở bước 3 và thẻ Tra cứu).
  const statuses = [
    { t: tr("Mới"), bg: "oklch(0.95 0.03 250)", fg: "oklch(0.42 0.12 250)", dot: "oklch(0.6 0.13 250)" },
    { t: tr("Đang liên hệ"), bg: "oklch(0.96 0.05 75)", fg: "oklch(0.48 0.13 55)", dot: "oklch(0.7 0.15 60)" },
    { t: tr("Đã xác nhận"), bg: "oklch(0.94 0.05 155)", fg: "oklch(0.36 0.1 155)", dot: "oklch(0.55 0.12 155)" },
    { t: tr("Hoàn thành"), bg: "oklch(0.95 0.005 160)", fg: "oklch(0.4 0.02 160)", dot: "oklch(0.6 0.02 160)" },
  ];

  // Quy trình 6 bước: mỗi bước = việc bạn làm + điều sẽ xảy ra + lưu ý.
  const flow: GuideStep[] = [
    {
      icon: I.cal,
      title: tr("Chọn dịch vụ & ngày"),
      lead: tr("Chọn loại dịch vụ bạn cần rồi nhập ngày đi, ngày về. Giá và chỗ trống hiện đúng theo ngày bạn chọn."),
      points: [
        tr("Trên menu, mở Xe cabin, Homestay, Combo, Thuê xe máy, Xe ôm hoặc Taxi."),
        tr("Nhập ngày đi / ngày về (homestay: ngày nhận và trả phòng) cùng số khách, rồi bấm Tìm."),
        tr("Chỉ những nhà xe, phòng còn trống trong đúng ngày đó mới hiện là đặt được, kèm giá của ngày đó (cuối tuần, lễ có thể khác ngày thường)."),
      ],
      tip: tr("Đi xe cabin đêm: ngày đi là đêm lên xe, sáng hôm sau mới tới Tà Xùa nhận phòng."),
    },
    {
      icon: I.form,
      title: tr("Chọn, điền thông tin & gửi yêu cầu"),
      lead: tr("Chọn phòng, vé hoặc xe, xem bill tạm tính rồi để lại tên và số điện thoại. Bước này chưa phải trả tiền."),
      points: [
        tr("Chọn phòng / số vé (cabin đơn, cabin đôi) / loại xe. Xe cabin chọn thêm điểm đón và điểm trả."),
        tr("Bill bên cạnh tự cộng từng khoản để bạn biết tổng tiền trước khi gửi."),
        tr("Điền họ tên, số điện thoại (nên là số có Zalo) và email nếu muốn nhận thông tin đơn qua thư."),
        tr("Bấm Gửi yêu cầu. Trang web không thu tiền online và không yêu cầu thẻ ngân hàng."),
      ],
    },
    {
      icon: I.code,
      title: tr("Nhận mã đơn để tra cứu"),
      lead: tr("Gửi xong, màn hình hiện mã đơn. Đây là mã để bạn và Tà Xùa Booking cùng theo dõi đơn."),
      points: [
        tr("Mã đơn có dạng TX-HT-AB23K (homestay), TX-XC-… (xe cabin), TX-CB-… (combo)."),
        tr("Chụp màn hình hoặc ghi lại mã. Nếu đã điền email, thư báo đã nhận yêu cầu được gửi kèm mã này."),
        tr("Vào trang Tra cứu, nhập mã đơn hoặc số điện thoại đã đặt để xem đơn đang ở bước nào."),
      ],
      chips: statuses.map(({ t, bg, fg }) => ({ t, bg, fg })),
      cta: { href: "/tra-cuu", label: tr("Tra cứu đơn của tôi →") },
    },
    {
      icon: I.phone,
      title: tr("Tà Xùa Booking gọi tư vấn thêm"),
      lead: tr("Nhân viên Tà Xùa Booking gọi hoặc nhắn Zalo theo số bạn để lại để chốt lại chi tiết chuyến đi."),
      points: [
        tr("Kiểm tra lại ngày, số khách, phòng / chỗ nằm, điểm đón và tổng tiền."),
        tr("Tư vấn thêm nếu bạn cần: đổi phòng, thêm xe máy, xe ôm, lịch trình, thời tiết và mây những ngày đó."),
        tr("Bạn chưa cần chuyển khoản ở bước này. Hỏi cho rõ mọi thứ rồi mới quyết định."),
      ],
      tip: tr("Chưa thấy ai liên hệ? Gọi hoặc nhắn Zalo cho Tà Xùa Booking kèm mã đơn để được xử lý ngay."),
    },
    {
      icon: I.shield,
      title: tr("Kiểm chứng với chủ cơ sở trước khi cọc"),
      lead: tr("Chốt xong với Tà Xùa Booking, bạn chưa cần chuyển tiền ngay. Cứ hỏi lại chủ homestay hoặc nhà xe cho chắc rồi hãy cọc."),
      points: [
        tr("Sau khi bạn xác nhận ở bước 4, Tà Xùa Booking báo ngay đơn của bạn cho chủ homestay hoặc nhà xe, nên bên đó đã biết có đơn này."),
        tr("Bạn gọi hoặc nhắn thẳng cho chủ cơ sở, đọc mã đơn và hỏi 2 điều: Tà Xùa Booking có phải đối tác của họ không, và đơn này có đúng ngày, đúng phòng / chỗ bạn đã đặt không."),
        tr("Xem thêm trang Cam kết uy tín để biết Tà Xùa Booking cam kết gì với khách đặt qua web."),
        tr("Yên tâm rồi mới chuyển khoản tiền cọc (thường 50% tổng tiền) theo hướng dẫn trong tin nhắn. Phần còn lại trả khi nhận phòng hoặc lên xe."),
      ],
      tip: tr("Đơn chưa cọc chỉ được giữ trong thời hạn ghi ở tin nhắn; quá hạn đơn tự huỷ và chỗ được nhả cho khách khác."),
      cta: { href: "/cam-ket", label: tr("Xem cam kết uy tín →") },
    },
    {
      icon: I.chatok,
      title: tr("Xác nhận giữ chỗ qua Zalo & email"),
      lead: tr("Nhận được cọc, Tà Xùa Booking giữ chỗ với chủ cơ sở rồi gửi bạn bản xác nhận đầy đủ."),
      points: [
        tr("Tin xác nhận qua Zalo ghi rõ: tên khách, phòng hoặc nhà xe, giờ đón, điểm đón, ngày nhận / trả, tổng tiền, đã cọc và còn lại."),
        tr("Nếu bạn đã điền email, một thư xác nhận với cùng nội dung được gửi tới hộp thư."),
        tr("Trang Tra cứu chuyển đơn sang “Đã xác nhận”. Đến ngày đi, chỉ cần đọc mã đơn hoặc số điện thoại cho homestay, nhà xe."),
      ],
      tip: tr("Đi xe cabin: trước 17h ngày lên xe mà tài xế chưa gọi, hãy báo Tà Xùa Booking để được hỗ trợ."),
    },
  ];

  const promises = [
    { i: I.tag, t: tr("Giá theo đúng ngày"), d: tr("Cuối tuần, lễ hiện riêng, không tự đẩy giá.") },
    { i: I.lock, t: tr("Không thu tiền online"), d: tr("Chỉ cọc sau khi đã gọi tư vấn và kiểm chứng.") },
    { i: I.user, t: tr("Người thật hỗ trợ"), d: tr("Gọi lại cho bạn trong giờ làm việc.") },
  ];

  const services: { icon: string; title: string; href: string; bg: string; fg: string; cta: string; items: string[] }[] = [
    {
      icon: I.bus, title: tr("Đặt xe cabin"), href: "/xe-cabin", bg: "oklch(0.95 0.04 250)", fg: "oklch(0.42 0.12 250)", cta: tr("Đến đặt xe cabin"),
      items: [
        tr("Vào mục Xe cabin, chọn ngày đi (và ngày về nếu đi khứ hồi), bấm Tìm."),
        tr("Chọn nhà xe còn chỗ, số vé (cabin đơn / đôi), điểm đón / trả, rồi điền thông tin."),
        tr("Gửi yêu cầu, nhận mã đơn (VD: TX-XC-AB23K). Tà Xùa Booking gọi tư vấn và xác nhận chỗ."),
      ],
    },
    {
      icon: I.home, title: tr("Đặt homestay / bungalow"), href: "/homestay", bg: "oklch(0.95 0.035 155)", fg: "oklch(0.38 0.1 155)", cta: tr("Đến đặt homestay"),
      items: [
        tr("Vào mục Homestay, chọn ngày nhận / trả phòng để xem phòng trống và giá theo ngày."),
        tr("Mở một homestay, chọn phòng phù hợp rồi điền số khách và thông tin liên hệ."),
        tr("Gửi yêu cầu, nhận mã đơn. Tà Xùa Booking gọi tư vấn và xác nhận phòng."),
      ],
    },
    {
      icon: I.combo, title: tr("Đặt combo xe + phòng"), href: "/combo", bg: "oklch(0.96 0.05 70)", fg: "oklch(0.5 0.14 50)", cta: tr("Đến đặt combo"),
      items: [
        tr("Vào mục Combo, chọn ngày đi và ngày về, số người, mức giá mong muốn."),
        tr("Chọn combo phù hợp, kiểm tra xe và phòng đi kèm, rồi điền thông tin."),
        tr("Đi xe đêm: ngày đi là đêm lên xe, hôm sau mới nhận phòng, nên ngày về cách ngày đi tối thiểu 2 ngày."),
      ],
    },
    {
      icon: I.bike, title: tr("Thuê xe máy"), href: "/thue-xe-may", bg: "oklch(0.95 0.03 300)", fg: "oklch(0.45 0.12 300)", cta: tr("Đến thuê xe máy"),
      items: [
        tr("Vào mục Thuê xe máy, chọn ngày nhận / trả xe."),
        tr("Chọn loại xe, điền thông tin và gửi yêu cầu."),
        tr("Khi nhận xe cần mang CCCD hoặc bằng lái."),
      ],
    },
    {
      icon: I.car, title: tr("Xe ôm & taxi"), href: "/xe-om", bg: "oklch(0.95 0.02 200)", fg: "oklch(0.4 0.07 210)", cta: tr("Đến xe ôm & taxi"),
      items: [
        tr("Vào mục Xe ôm hoặc Taxi, xem các tuyến và giá tham khảo."),
        tr("Gửi yêu cầu theo tuyến, ngày và giờ đón."),
        tr("Cần gấp? Gọi trực tiếp tổng đài để được điều xe."),
      ],
    },
  ];

  const pill = "flex items-center gap-2 rounded-full px-4 py-[11px] text-sm font-extrabold";

  return (
    <div style={{ background: "oklch(0.975 0.008 150)", color: "oklch(0.22 0.03 160)" }}>
      {/* HERO */}
      <section style={{ background: "linear-gradient(180deg, oklch(0.95 0.025 160), oklch(0.975 0.008 150))", borderBottom: "1px solid oklch(0.93 0.01 160)" }}>
        <div className="mx-auto grid max-w-[1200px] items-end gap-[clamp(20px,4vw,48px)] px-[clamp(16px,3vw,28px)] pb-[clamp(24px,4vw,40px)] pt-[clamp(22px,4vw,44px)] min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <nav className="text-[13px]" style={{ color: "oklch(0.5 0.02 160)" }}>
              <Link href="/" className="hover:text-forest-700">{tr("Trang chủ")}</Link>
              <span className="mx-1.5 opacity-50">/</span>
              {tr("Hướng dẫn")}
            </nav>
            <h1 className="m-0 text-[clamp(30px,4.4vw,48px)] font-extrabold leading-[1.08] tracking-[-.03em] [text-wrap:balance]">{tr("Đặt dịch vụ Tà Xùa trong 6 bước")}</h1>
            <p className="m-0 max-w-[560px] text-[clamp(15px,1.5vw,17px)] leading-[1.65] [text-wrap:pretty]" style={{ color: "oklch(0.42 0.02 160)" }}>
              {tr("Xem giá và chỗ trống theo ngày, gửi yêu cầu, được gọi tư vấn và tự kiểm chứng với chủ cơ sở rồi mới đặt cọc.")}
            </p>
            <div className="flex flex-wrap gap-2">
              <CommitmentHeroLink className={`${pill} text-white transition hover:brightness-110`} />
              <Link href="/tra-cuu" className={`${pill} border bg-white`} style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.04 160)" }}>
                <Ico d={I.search} size={16} sw={2} />
                {tr("Tra cứu đơn")}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {promises.map((p) => (
              <div key={p.t} className="flex flex-col gap-2 rounded-2xl border bg-white p-3.5" style={{ borderColor: "oklch(0.91 0.015 160)" }}>
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: "oklch(0.95 0.035 155)", color: "oklch(0.38 0.09 158)" }}>
                  <Ico d={p.i} size={18} />
                </span>
                <b className="text-sm leading-[1.3]">{p.t}</b>
                <span className="text-xs leading-[1.45]" style={{ color: "oklch(0.5 0.02 160)" }}>{p.d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-[clamp(16px,3vw,28px)] pb-[clamp(40px,6vw,72px)] pt-[clamp(20px,3vw,36px)]">
        <GuideSteps steps={flow} phone={formatPhone(phone)} tel={tel}>
          {/* Cách đặt từng loại dịch vụ */}
          <section className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[.1em]" style={{ color: "oklch(0.5 0.08 158)" }}>{tr("Theo từng dịch vụ")}</div>
              <h2 className="mt-1 text-[clamp(22px,2.6vw,28px)] font-extrabold tracking-[-.02em]">{tr("Cách đặt từng loại dịch vụ")}</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
              {services.map((v) => (
                <div key={v.href} className="flex flex-col gap-3 rounded-[20px] border bg-white p-[18px] transition hover:-translate-y-0.5" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px]" style={{ background: v.bg, color: v.fg }}>
                      <Ico d={v.icon} />
                    </span>
                    <b className="text-[17px]">{v.title}</b>
                  </div>
                  <ol className="flex flex-1 flex-col gap-2">
                    {v.items.map((it, j) => (
                      <li key={it} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-sm leading-normal" style={{ color: "oklch(0.32 0.02 160)" }}>
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-[11px] font-extrabold" style={{ borderColor: "oklch(0.85 0.03 158)", color: "oklch(0.4 0.06 158)" }}>{j + 1}</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ol>
                  <Link href={v.href} className="rounded-xl px-3.5 py-[11px] text-sm font-extrabold transition hover:brightness-95" style={{ background: "oklch(0.97 0.012 155)", color: "oklch(0.33 0.08 158)" }}>
                    {v.cta}
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Tra cứu + Hỗ trợ */}
          <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3">
            <div className="flex flex-col gap-3 rounded-[22px] border bg-white p-[clamp(18px,2.6vw,26px)]" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px]" style={{ background: "oklch(0.95 0.035 155)", color: "oklch(0.38 0.09 158)" }}>
                  <Ico d={I.search} />
                </span>
                <b className="text-lg">{tr("Tra cứu tình trạng đơn")}</b>
              </div>
              <p className="m-0 text-sm leading-[1.6]" style={{ color: "oklch(0.42 0.02 160)" }}>{tr("Nhập mã đơn hoặc số điện thoại đã đặt để xem đơn đang ở bước nào.")}</p>
              <div className="flex flex-wrap items-center gap-1">
                {statuses.map((x, i) => (
                  <span key={x.t} className="flex items-center gap-1">
                    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-bold" style={{ background: x.bg, color: x.fg }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: x.dot }} />
                      {x.t}
                    </span>
                    {i < statuses.length - 1 && <span className="text-xs" style={{ color: "oklch(0.7 0.02 160)" }}>›</span>}
                  </span>
                ))}
              </div>
              <form action={await lp("/tra-cuu")} method="get" className="mt-0.5 flex gap-1.5">
                <input
                  name="q"
                  required
                  minLength={4}
                  placeholder={tr("TX-HT-AB23K hoặc 09xx xxx xxx")}
                  aria-label={tr("Tra cứu tình trạng đơn")}
                  className="min-w-0 flex-1 rounded-xl border-[1.5px] px-3.5 py-3 text-sm outline-none focus:border-forest-500"
                  style={{ borderColor: "oklch(0.88 0.015 160)" }}
                />
                <button className="whitespace-nowrap rounded-xl px-[18px] py-3 text-sm font-extrabold text-white" style={{ background: G }}>{tr("Tra cứu")}</button>
              </form>
            </div>
            <div className="flex flex-col gap-3 rounded-[22px] p-[clamp(18px,2.6vw,26px)] text-white" style={{ background: G }}>
              <div className="flex items-center gap-3">
                <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/10">
                  <Ico d={I.headset} />
                </span>
                <b className="text-lg">{tr("Cần hỗ trợ?")}</b>
              </div>
              <p className="m-0 text-sm leading-[1.6]" style={{ color: "oklch(0.87 0.02 160)" }}>
                {tr("Người thật trả lời từ {0} mỗi ngày. Gọi hoặc nhắn Zalo để được tư vấn và đặt nhanh.", [SITE.supportHours])}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5">
                <a href={`tel:${tel}`} className={`${pill} bg-white`} style={{ color: G }}>
                  <Ico d={I.phone} size={16} sw={2} />
                  {formatPhone(phone)}
                </a>
                {zalo && (
                  <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className={`${pill} text-white`} style={{ background: "oklch(0.68 0.18 45)" }}>
                    <Ico d={I.chat} size={16} sw={2} />
                    Chat Zalo
                  </a>
                )}
                <Link href="/lien-he" className="rounded-full border border-white/30 px-4 py-[11px] text-sm font-bold text-white">{tr("Trang liên hệ")}</Link>
              </div>
            </div>
          </section>
        </GuideSteps>
      </div>
    </div>
  );
}
