import type { Metadata } from "next";
import { Suspense } from "react";
import CategorySkeleton from "@/components/skeletons/CategorySkeleton";
import { SitePhone } from "@/components/SiteContact";
import { notFound } from "next/navigation";
import { categoryBySlug, CATEGORY_LIST } from "@/lib/constants";
import { listServicesByCategory, getHomestayRoomCards, getRentalBikes, getXeomRoutes, getTaxiRoutes, getTransportPoints, type ListFilters } from "@/lib/queries";
import { getCabinOperators } from "@/lib/cabin";
import { HomestayList } from "@/components/home/HomestayList";
import { MotorbikeList } from "@/components/moto/MotorbikeList";
import { XeomList } from "@/components/xeom/XeomList";
import { TaxiList } from "@/components/taxi/TaxiList";
import { findComboMatches, getComboOrigins, parseComboFilters } from "@/lib/combo";
import { ServiceCard } from "@/components/ServiceCard";
import { CabinList } from "@/components/cabin/CabinList";
import { ComboSearch } from "@/components/combo/ComboSearch";
import { ComboResults } from "@/components/combo/ComboResults";
import { ComboHero } from "@/components/combo/ComboHero";
import { ComboCustom } from "@/components/combo/ComboCustom";
import { ComboModeSwitch, ComboModeSlot } from "@/components/combo/ComboModeSwitch";
import { FilterBar } from "@/components/FilterBar";
import { ScrollToResults } from "@/components/ScrollToResults";
import { ogBlock } from "@/lib/og";
import { categoryShareImage } from "@/lib/og-source";
import { SeoBlock } from "@/components/SeoBlock";

/** Tiêu đề + mô tả tìm kiếm riêng cho 3 trang đặt dịch vụ chính (các danh mục khác dùng mẫu chung). */
const SEO_META: Record<string, { title: string; description: string }> = {
  MOTORBIKE: {
    title: "Thuê xe máy Tà Xùa: giá thuê theo ngày & xe còn trống",
    description: "Thuê xe máy ở Tà Xùa đi săn mây: xe số bền, khoẻ, leo đèo tốt, giá thuê theo ngày. Chọn ngày nhận, ngày trả để xem xe còn trống và gửi yêu cầu đặt xe nhanh.",
  },
  XEOM: {
    title: "Xe ôm Tà Xùa: tài xế bản địa, giá theo tuyến",
    description: "Xe ôm Tà Xùa do tài xế bản địa chở tới Sống lưng khủng long, Mỏm cá heo, Cây cô đơn và các điểm đường khó. Xem giá từng tuyến và gửi yêu cầu đặt xe.",
  },
  TAXI: {
    title: "Taxi Tà Xùa: xe 4–7 chỗ, giá theo ngày",
    description: "Taxi Tà Xùa xe 4 đến 7 chỗ đưa đón Bắc Yên – Tà Xùa và các điểm săn mây, hợp với gia đình có người lớn tuổi, trẻ nhỏ. Xem giá thuê theo ngày và đặt xe nhanh.",
  },
  CABIN: {
    title: "Xe cabin Hà Nội – Tà Xùa: giá vé & chỗ trống",
    description: "Đặt xe cabin giường nằm Hà Nội – Tà Xùa và các tỉnh: vé khứ hồi từ 500.000đ, chạy đêm 21h tới 6h sáng. Xem nhà xe còn chỗ theo ngày, đặt vé cả hai chiều.",
  },
  HOMESTAY: {
    title: "Homestay Tà Xùa: giá & phòng trống theo ngày",
    description: "Hơn 30 homestay, bungalow Tà Xùa view biển mây ở trung tâm, Đỉnh Gió, Khe Cải. Xem giá từng phòng và phòng trống theo ngày, đặt phòng không cần thanh toán online.",
  },
  COMBO: {
    title: "Combo Tà Xùa: xe cabin khứ hồi + homestay trọn gói",
    description: "Combo Tà Xùa ghép sẵn xe cabin khứ hồi và phòng homestay còn trống đúng ngày bạn đi. Nhập ngày, số người, ngân sách để xem giá trọn gói mỗi người.",
  },
};
import { addDays, parseDateOnly, toDateKey, today, isValidDateKey } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { dmy } from "@/lib/date-format";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";
import Link from "@/components/Link";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const t = await getT();
  const { category } = await params;
  const cat = categoryBySlug(category);
  if (!cat) return {};
  const custom = SEO_META[cat.key];
  const title = custom ? t(custom.title) : t("{0}: giá & tình trạng còn chỗ", [t(cat.label)]);
  const description = custom ? t(custom.description) : t("{0}: {1}. Xem giá và tình trạng còn chỗ theo ngày, gửi yêu cầu đặt nhanh tại Tà Xùa Booking.", [t(cat.label), t(cat.tagline)]);
  return {
    title,
    description,
    alternates: await i18nAlternates(`/${cat.slug}`),
    // Ảnh chia sẻ = ảnh bìa dịch vụ nổi bật của chính danh mục này (xe cabin ra ảnh xe, homestay ra ảnh phòng...).
    openGraph: await i18nOg({ title, description, path: `/${cat.slug}`, image: await categoryShareImage(cat.key), alt: t(cat.label) }),
  };
}

/**
 * Khung chờ đặt bằng <Suspense> NGAY TRONG trang (không dùng `loading.tsx`): `loading.tsx` ở đây sẽ bọc
 * luôn các trang con /[slug], khiến trang không tồn tại vẫn trả mã 200 (Google coi là "soft 404").
 */
export default function CategoryPage(props: { params: Promise<{ category: string }>; searchParams: SP }) {
  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryBody {...props} />
    </Suspense>
  );
}

async function CategoryBody({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: SP;
}) {
  const t = await getT();
  const { category } = await params;
  const cat = categoryBySlug(category);
  if (!cat) notFound();

  const sp = await searchParams;
  /** Số khách từ URL (?pax=), mặc định 2, kẹp 1..20. */
  const paxParam = (v: unknown) => {
    const n = Math.floor(Number(typeof v === "string" ? v : NaN));
    return Number.isFinite(n) && n >= 1 ? Math.min(20, n) : 2;
  };

  // ----- Xe cabin: tìm vé theo ngày đi/về → danh sách nhà xe còn chỗ -----
  if (cat.key === "CABIN") {
    const from = str(sp.from);
    const to = str(sp.to);
    const pickup = str(sp.pickup)?.trim() || null;
    // Mặc định (chưa chọn ngày) vẫn hiện tất cả nhà xe; chọn ngày để lọc theo chỗ trống.
    // Chọn điểm đón → giá lấy theo bảng giá chặng; danh sách điểm đón cũng lấy từ bảng giá.
    const [operators, pickups] = await Promise.all([
      getCabinOperators(from ?? null, to ?? null, pickup),
      getComboOrigins(),
    ]);
    return (
      <>
        <CabinList operators={operators} from={from ?? ""} to={to ?? ""} pickup={pickup ?? ""} pickups={pickups} pax={paxParam(sp.pax)} />
        <SeoBlock kind="CABIN" />
      </>
    );
  }

  // ----- Combo: tìm xe + phòng khớp giá mong muốn -----
  if (cat.key === "COMBO") {
    // Vào /combo chưa chọn ngày ⇒ hiện sẵn KẾT QUẢ MẪU: combo 2 ngày 1 đêm tính từ hôm nay
    // (đi tối nay → nhận phòng sáng mai → về ngày kia), 2 người lớn. Khách đổi ngày/số người rồi tìm lại.
    const isSample = !str(sp.from) && !str(sp.to);
    const from = isSample ? toDateKey(today()) : str(sp.from);
    const to = isSample ? toDateKey(addDays(today(), 2)) : str(sp.to);
    const origin = str(sp.origin)?.trim() || "";
    // `people` (link cũ) = số người lớn; `kids=5-8` = tuổi từng trẻ.
    // Tối đa 30 người lớn = giới hạn của form đặt combo (comboBookingSchema) — vượt thì phương án hiện ra nhưng không đặt được.
    const adults = Math.min(30, Math.max(1, Math.floor(Number(str(sp.people))) || 2));
    const childrenAges = (str(sp.kids) ?? "")
      .split("-")
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 17)
      .slice(0, 20);
    // Khoảng giá từ dropdown: "lt900000" = dưới 900k, "gt2000000" = trên 2tr.
    const priceKey = str(sp.price) ?? "";
    const pm = priceKey.match(/^(lt|gt)(\d+)$/);
    const priceMax = pm && pm[1] === "lt" ? Number(pm[2]) : null;
    const priceMin = pm && pm[1] === "gt" ? Number(pm[2]) : null;
    const budget = str(sp.budget) ? Number(str(sp.budget)) : null; // link cũ (?budget=) vẫn chạy
    const comboFilters = parseComboFilters(str(sp.f));
    const activeFilters = Object.entries(comboFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const kindRaw = str(sp.kind);
    const roomKind = (["single", "double", "dorm"].includes(kindRaw ?? "") ? kindRaw : "all") as
      | "all"
      | "single"
      | "double"
      | "dorm";
    // 2 chế độ: "Combo gợi ý" (mặc định — ghép sẵn theo từng home) / "Combo tự chọn" (?mode=tu-chon —
    // khách tự chọn homestay, nhiều phòng, nhà xe và số vé).
    const custom = str(sp.mode) === "tu-chon";
    const [origins, result] = await Promise.all([
      getComboOrigins(),
      from && to
        ? findComboMatches({ fromKey: from, toKey: to, people: adults, adults, childrenAges, origin: origin || null, budget, priceMax, priceMin, filters: comboFilters, roomKind, keepAllHomes: custom })
        : Promise.resolve(null),
    ]);
    // Link chuyển chế độ: giữ nguyên mọi tham số tìm kiếm đang có.
    const modeHref = (toCustom: boolean) => {
      const q = new URLSearchParams();
      if (!isSample) {
        if (from) q.set("from", from);
        if (to) q.set("to", to);
        q.set("people", String(adults));
      }
      if (childrenAges.length) q.set("kids", childrenAges.join("-"));
      if (origin) q.set("origin", origin);
      if (pm) q.set("price", priceKey);
      if (activeFilters.length) q.set("f", activeFilters.join(","));
      if (roomKind !== "all") q.set("kind", roomKind);
      if (toCustom) q.set("mode", "tu-chon");
      const s = q.toString();
      return s ? `/combo?${s}` : "/combo";
    };
    // ComboResults / ComboCustom tự có chỗ đặt công tắc chế độ (cùng hàng bộ lọc); các trạng thái còn lại dùng slot ở trang.
    const hasList = Boolean(from && to && result && (custom ? result.homes.length > 0 || (result.planCount > 0 && result.busCount > 0) : result.planCount > 0 && result.busCount > 0));

    return (
      <div style={{ background: "oklch(0.975 0.01 150)" }}>
        <ComboHero />
        <div className="container-page relative z-[5] -mt-[70px] pb-16">
        <ComboSearch
          initialFrom={from ?? ""}
          initialTo={to ?? ""}
          initialPeople={adults}
          initialKids={childrenAges}
          initialPrice={pm ? priceKey : ""}
          initialFilters={activeFilters}
          initialKind={roomKind}
          initialOrigin={origin}
          origins={origins}
          mode={custom ? "tu-chon" : ""}
        />

        <ScrollToResults token={`${from ?? ""}|${to ?? ""}|${custom ? 1 : 0}`} enabled={(Boolean(from && to) && !isSample) || custom} offset={12}>
        {/* Nút chuyển 2 chế độ combo (núm đẩy + nhân vật cầm cờ) */}
        <ComboModeSwitch
          mode={custom ? "custom" : "sug"}
          sugHref={modeHref(false)}
          customHref={modeHref(true)}
          sugCount={result && result.busCount > 0 ? result.planCount : null}
        />
        <div className="mt-6">
          {/* Không có danh sách kết quả (chưa chọn ngày / không ghép được) ⇒ công tắc nằm riêng một hàng. */}
          {!hasList && <div className="mb-4 flex justify-end pt-3 sm:pt-0"><ComboModeSlot /></div>}
          {!custom && isSample && result != null && result.planCount > 0 && result.busCount > 0 && (
            <p className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm text-gray-600 ring-1 ring-forest-200">
              <b className="text-forest-700">{t("Gợi ý combo 2 ngày 1 đêm")}</b>{" · "}
              {t("đi {0} – về {1} · {2} người lớn. Đổi ngày, số người ở ô tìm kiếm phía trên để xem giá đúng chuyến của bạn.", [dmy(from!), dmy(to!), adults])}
            </p>
          )}
          {!from || !to ? (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-gray-500">
              {t("Chọn ngày đi và ngày về để tìm combo.")}
            </p>
          ) : result == null ? (
            (() => {
              // Khách thường chọn "Ngày đi" = ngày muốn NHẬN PHÒNG → gợi ý lùi 1 ngày kèm link tìm lại.
              const fmtD = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
              const valid = isValidDateKey(from!) && isValidDateKey(to!);
              let fixFrom = "", fixTo = "", fixUrl = "";
              if (valid) {
                fixFrom = toDateKey(addDays(parseDateOnly(from!), -1));
                fixTo = to! > from! ? to! : toDateKey(addDays(parseDateOnly(from!), 1));
                if (fixFrom >= toDateKey(today())) {
                  const q = new URLSearchParams({ from: fixFrom, to: fixTo, people: String(adults) });
                  if (childrenAges.length) q.set("kids", childrenAges.join("-"));
                  if (origin) q.set("origin", origin);
                  if (pm) q.set("price", priceKey);
                  if (activeFilters.length) q.set("f", activeFilters.join(","));
                  if (roomKind !== "all") q.set("kind", roomKind);
                  fixUrl = `/combo?${q.toString()}`;
                }
              }
              return (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
                  <p className="text-lg font-medium text-gray-700">{t("Khoảng ngày này chưa có đêm nghỉ nào ở homestay")}</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                    <b>{t("Ngày đi là đêm bạn lên xe")}</b>{" "}{t("— xe chạy xuyên đêm, sáng hôm sau mới tới Tà Xùa nhận phòng.")}
                    {valid ? (
                      <>
                        {" "}{t("Nếu bạn muốn")}{" "}<b>{t("nhận phòng ngày {0}", [fmtD(from!)])}</b>{" "}{t("và")}{" "}<b>{t("trả phòng ngày {0}", [fmtD(fixTo)])}</b>{t(", hãy tìm với")}{" "}<b>{t("Ngày đi {0}", [fmtD(fixFrom)])}</b> · <b>{t("Ngày về {0}", [fmtD(fixTo)])}</b>.
                      </>
                    ) : (
                      <>{" "}{t("Ví dụ: muốn nhận phòng ngày 15 và trả ngày 16 → chọn Ngày đi 14, Ngày về 16.")}</>
                    )}
                  </p>
                  {fixUrl && (
                    <a
                      href={fixUrl}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sunset-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sunset-600"
                    >
                      {t("Tìm lại: đi {0} → về {1} →", [fmtD(fixFrom), fmtD(fixTo)])}
                    </a>
                  )}
                </div>
              );
            })()
          ) : custom && result.homes.length > 0 ? (
            <ComboCustom key={`${from}|${to}|${adults}|${childrenAges.join("-")}`} result={result} suggestHref={modeHref(false)} />
          ) : result.planCount === 0 || result.busCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center">
              <p className="text-lg font-medium text-gray-700">{t("Chưa ghép được combo phù hợp")}</p>
              <p className="mt-1 text-sm text-gray-500">
                {result.busCount === 0
                  ? result.origin
                    ? t("Chưa có nhà xe nhận đón tại {0} (mở cả chuyến đi lẫn về) cho ngày này.", [t(result.origin)])
                    : t("Chưa có nhà xe mở cả chuyến đi lẫn về cho ngày này.")
                  : result.planCount === 0
                    ? t("Chưa ghép được đủ chỗ cho cả đoàn từ các phòng trống khớp tiêu chí — thử nới tiêu chí, giảm số người hoặc đổi ngày.")
                    : t("Thử nới tiêu chí hoặc đổi ngày.")}{" "}
                {t("Hoặc liên hệ")}{" "}<SitePhone />.
              </p>
            </div>
          ) : (
            <ComboResults result={result} />
          )}
        </div>
        </ScrollToResults>

        {/* SeoBlock tự có container-page (đệm 1rem / 1.5rem) mà ở đây đã nằm trong container-page ⇒ bù lề âm để khung rộng bằng khu đặt combo phía trên. */}
        <div className="-mx-4 mt-10 sm:-mx-6"><SeoBlock kind="COMBO" /></div>

        <section className="mt-2 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-500">{t("Dịch vụ khác tại Tà Xùa")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_LIST.filter((c) => c.slug !== cat.slug).map((c) => (
              <Link key={c.slug} href={`/${c.slug}`} className="rounded-full bg-white px-4 py-2 text-sm text-forest-700 ring-1 ring-forest-200 hover:bg-forest-50">
                {t(c.label)}
              </Link>
            ))}
          </div>
        </section>
        </div>
      </div>
    );
  }

  // ----- Homestay: trang danh sách "biển mây" (hero động + tìm kiếm + lưới) -----
  if (cat.key === "HOMESTAY") {
    const homestays = await getHomestayRoomCards(str(sp.from) ?? null, str(sp.to) ?? null);
    // Ảnh bìa + tóm tắt của nhà: gửi xuống client 1 lần/nhà (tách khỏi ~400 thẻ phòng để payload không phình).
    const homeInfo = Object.fromEntries(homestays.map((h) => [h.slug, { cover: h.homeCover ?? null, desc: h.homeDesc ?? "" }]));
    const roomCards = homestays.map(({ homeCover: _c, homeDesc: _d, ...r }) => r);
    return (
      <>
        <HomestayList
          items={roomCards}
          homeInfo={homeInfo}
          initialFrom={str(sp.from) ?? ""}
          initialTo={str(sp.to) ?? ""}
          initialQ={str(sp.q) ?? ""}
          initialView={str(sp.view) === "home" ? "home" : "room"}
          initialPeople={Math.min(20, Math.max(0, Math.trunc(Number(str(sp.people))) || 0))}
        />
        {/* Link tới MỌI homestay, dựng phía server: lưới thẻ phía trên chỉ dựng 24 thẻ đầu (cuộn mới nạp thêm)
            nên Google không thấy link của các homestay còn lại. */}
        <nav aria-label={t("Tất cả homestay tại Tà Xùa")} className="container-page pb-6 pt-2">
          <h2 className="text-sm font-semibold text-gray-500">{t("Tất cả homestay tại Tà Xùa")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...new Map(homestays.map((h) => [h.slug, h.homeName])).entries()].map(([slug, name]) => (
              <Link key={slug} href={`/homestay/${slug}`} className="rounded-full bg-white px-3.5 py-2 text-sm text-forest-700 ring-1 ring-forest-200 hover:bg-forest-50">
                {t(name)}
              </Link>
            ))}
          </div>
        </nav>
        <SeoBlock kind="HOMESTAY" />
      </>
    );
  }

  // ----- Thuê xe máy: hero động + tìm kiếm + lưới xe (bám thiết kế) -----
  if (cat.key === "MOTORBIKE") {
    const from = str(sp.from);
    const to = str(sp.to);
    const bikes = await getRentalBikes(from ?? null, to ?? null);
    return <MotorbikeList bikes={bikes} from={from ?? ""} to={to ?? ""} />;
  }

  // ----- Xe ôm: hero động + tìm kiếm + danh sách tuyến (bám thiết kế) -----
  if (cat.key === "XEOM") {
    const [routes, points] = await Promise.all([getXeomRoutes(), getTransportPoints()]);
    return <XeomList routes={routes} points={points} />;
  }

  // ----- Taxi: hero động + tìm kiếm + danh sách tuyến (bám thiết kế) -----
  if (cat.key === "TAXI") {
    const [routes, points] = await Promise.all([getTaxiRoutes(), getTransportPoints()]);
    return <TaxiList routes={routes} points={points} />;
  }

  const filters: ListFilters = {
    q: str(sp.q),
    from: str(sp.from),
    to: str(sp.to),
    priceMin: str(sp.priceMin) ? Number(str(sp.priceMin)) : undefined,
    priceMax: str(sp.priceMax) ? Number(str(sp.priceMax)) : undefined,
  };

  const services = await listServicesByCategory(cat.key, filters);
  const hasDateFilter = Boolean(filters.from);

  return (
    <div className="container-page py-8">
      {/* breadcrumb */}
      <nav className="mb-3 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">{t("Trang chủ")}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{t(cat.shortLabel)}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t(cat.label)}</h1>
        <p className="mt-1 text-gray-500">{t(cat.tagline)}</p>
      </header>

      <FilterBar
        kind={cat.availabilityKind}
        initial={{
          q: filters.q,
          from: filters.from,
          to: filters.to,
          priceMin: str(sp.priceMin),
          priceMax: str(sp.priceMax),
        }}
      />

      {hasDateFilter && (
        <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-sky-100">
          {t("Tình trạng hiển thị theo ngày bạn chọn. Nếu dịch vụ hiển thị “Chưa cập nhật” hoặc “Chờ xác nhận”, vui lòng gửi yêu cầu để được xác nhận lại.")}
        </p>
      )}

      <ScrollToResults
        token={`${filters.q ?? ""}|${filters.from ?? ""}|${filters.to ?? ""}|${filters.priceMin ?? ""}|${filters.priceMax ?? ""}`}
        enabled={Boolean(filters.q || filters.from || filters.priceMin || filters.priceMax)}
        offset={12}
      >
      <div className="mt-6">
        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <p className="text-lg font-medium text-gray-700">
              {t("Chưa tìm thấy dịch vụ phù hợp")}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t("Thử bỏ bớt bộ lọc hoặc chọn ngày khác.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </div>
      </ScrollToResults>

      {/* liên kết SEO sang các danh mục khác */}
      <section className="mt-12 border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-500">{t("Dịch vụ khác tại Tà Xùa")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_LIST.filter((c) => c.slug !== cat.slug).map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="rounded-full bg-white px-4 py-2 text-sm text-forest-700 ring-1 ring-forest-200 hover:bg-forest-50"
            >
              {t(c.label)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
