import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoryBySlug, CATEGORY_LIST } from "@/lib/constants";
import { listServicesByCategory, getHomestayRoomCards, getRentalBikes, getXeomRoutes, getTaxiRoutes, type ListFilters } from "@/lib/queries";
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
import { FilterBar } from "@/components/FilterBar";
import { ScrollToResults } from "@/components/ScrollToResults";
import { SITE } from "@/lib/site";
import { addDays, parseDateOnly, toDateKey, today, isValidDateKey } from "@/lib/dates";

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
  const { category } = await params;
  const cat = categoryBySlug(category);
  if (!cat) return {};
  const title = `${cat.label} — Giá & tình trạng còn chỗ`;
  const description = `${cat.label}: ${cat.tagline}. Xem giá và tình trạng còn chỗ theo ngày, gửi yêu cầu đặt nhanh tại Tà Xùa Booking.`;
  return {
    title,
    description,
    alternates: { canonical: `/${cat.slug}` },
    openGraph: { title, description, url: `${SITE.url}/${cat.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: SP;
}) {
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
    return <CabinList operators={operators} from={from ?? ""} to={to ?? ""} pickup={pickup ?? ""} pickups={pickups} pax={paxParam(sp.pax)} />;
  }

  // ----- Combo: tìm xe + phòng khớp giá mong muốn -----
  if (cat.key === "COMBO") {
    const from = str(sp.from);
    const to = str(sp.to);
    const origin = str(sp.origin)?.trim() || "";
    // `people` (link cũ) = số người lớn; `kids=5-8` = tuổi từng trẻ.
    const adults = Math.max(1, Number(str(sp.people)) || 2);
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
    const [origins, result] = await Promise.all([
      getComboOrigins(),
      from && to
        ? findComboMatches({ fromKey: from, toKey: to, people: adults, adults, childrenAges, origin: origin || null, budget, priceMax, priceMin, filters: comboFilters, roomKind })
        : Promise.resolve(null),
    ]);

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
        />

        <ScrollToResults token={`${from ?? ""}|${to ?? ""}`} enabled={Boolean(from && to)} offset={12}>
        <div className="mt-6">
          {!from || !to ? (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-gray-500">
              Chọn ngày đi và ngày về để tìm combo.
            </p>
          ) : result == null ? (
            (() => {
              // Khách thường chọn "Ngày đi" = ngày muốn NHẬN PHÒNG → gợi ý lùi 1 ngày kèm link tìm lại.
              const fmtD = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
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
                  <p className="text-lg font-medium text-gray-700">Khoảng ngày này chưa có đêm nghỉ nào ở homestay</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                    <b>Ngày đi là đêm bạn lên xe</b> — xe chạy xuyên đêm, sáng hôm sau mới tới Tà Xùa nhận phòng.
                    {valid ? (
                      <>
                        {" "}Nếu bạn muốn <b>nhận phòng ngày {fmtD(from!)}</b> và <b>trả phòng ngày {fmtD(fixTo)}</b>,
                        hãy tìm với <b>Ngày đi {fmtD(fixFrom)}</b> · <b>Ngày về {fmtD(fixTo)}</b>.
                      </>
                    ) : (
                      <> Ví dụ: muốn nhận phòng ngày 15 và trả ngày 16 → chọn Ngày đi 14, Ngày về 16.</>
                    )}
                  </p>
                  {fixUrl && (
                    <a
                      href={fixUrl}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sunset-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sunset-600"
                    >
                      Tìm lại: đi {fmtD(fixFrom)} → về {fmtD(fixTo)} →
                    </a>
                  )}
                </div>
              );
            })()
          ) : result.planCount === 0 || result.busCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center">
              <p className="text-lg font-medium text-gray-700">Chưa ghép được combo phù hợp</p>
              <p className="mt-1 text-sm text-gray-500">
                {result.busCount === 0
                  ? result.origin
                    ? `Chưa có nhà xe nhận đón tại ${result.origin} (mở cả chuyến đi lẫn về) cho ngày này.`
                    : "Chưa có nhà xe mở cả chuyến đi lẫn về cho ngày này."
                  : result.planCount === 0
                    ? "Chưa ghép được đủ chỗ cho cả đoàn từ các phòng trống khớp tiêu chí — thử nới tiêu chí, giảm số người hoặc đổi ngày."
                    : "Thử nới tiêu chí hoặc đổi ngày."}{" "}
                Hoặc liên hệ {SITE.defaultPhone}.
              </p>
            </div>
          ) : (
            <ComboResults result={result} />
          )}
        </div>
        </ScrollToResults>

        <section className="mt-12 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-500">Dịch vụ khác tại Tà Xùa</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_LIST.filter((c) => c.slug !== cat.slug).map((c) => (
              <a key={c.slug} href={`/${c.slug}`} className="rounded-full bg-white px-4 py-2 text-sm text-forest-700 ring-1 ring-forest-200 hover:bg-forest-50">
                {c.label}
              </a>
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
    return (
      <HomestayList
        items={homestays}
        initialFrom={str(sp.from) ?? ""}
        initialTo={str(sp.to) ?? ""}
        initialQ={str(sp.q) ?? ""}
        initialPeople={Math.min(20, Math.max(0, Math.trunc(Number(str(sp.people))) || 0))}
      />
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
    const routes = await getXeomRoutes();
    return <XeomList routes={routes} />;
  }

  // ----- Taxi: hero động + tìm kiếm + danh sách tuyến (bám thiết kế) -----
  if (cat.key === "TAXI") {
    const routes = await getTaxiRoutes();
    return <TaxiList routes={routes} />;
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
        <a href="/" className="hover:text-forest-700">Trang chủ</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{cat.shortLabel}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{cat.label}</h1>
        <p className="mt-1 text-gray-500">{cat.tagline}</p>
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
          Tình trạng hiển thị theo ngày bạn chọn. Nếu dịch vụ hiển thị
          “Chưa cập nhật” hoặc “Chờ xác nhận”, vui lòng gửi yêu cầu để được
          xác nhận lại.
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
              Chưa tìm thấy dịch vụ phù hợp
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Thử bỏ bớt bộ lọc hoặc chọn ngày khác.
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
        <h2 className="text-sm font-semibold text-gray-500">Dịch vụ khác tại Tà Xùa</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_LIST.filter((c) => c.slug !== cat.slug).map((c) => (
            <a
              key={c.slug}
              href={`/${c.slug}`}
              className="rounded-full bg-white px-4 py-2 text-sm text-forest-700 ring-1 ring-forest-200 hover:bg-forest-50"
            >
              {c.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
