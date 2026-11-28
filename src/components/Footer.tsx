import Link from "@/components/Link";
import { CATEGORY_LIST } from "@/lib/constants";
import { SITE } from "@/lib/site";
import { formatPhone } from "@/lib/trust-popup";
import { getT } from "@/lib/i18n/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Link chân trang tới homestay MỚI nhất + mọi điểm tham quan: trang nào đã được Google lập chỉ mục
 * cũng trỏ tới trang mới ⇒ Google phát hiện nhanh hơn (site mới, Google thu thập chậm).
 */
const footerLinks = unstable_cache(
  async () => {
    const [homes, places] = await Promise.all([
      prisma.service.findMany({
        where: { published: true, category: { in: ["HOMESTAY", "BUNGALOW"] } },
        select: { slug: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.place.findMany({
        where: { published: true, kind: "CHECKIN", slug: { not: null } },
        select: { slug: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    return { homes, places };
  },
  ["footer-links"],
  { revalidate: 1800 },
);

export async function Footer({ settings }: { settings: Record<string, string> }) {
  const t = await getT();
  const phone = settings.contactPhone || SITE.defaultPhone;
  const email = SITE.email;
  // Thông tin pháp lý (SiteSettings: legalName, taxCode) — có thì mới hiện.
  const legalName = settings.legalName || SITE.legalName;
  const taxCode = settings.taxCode || SITE.taxCode;
  const legalAddress = settings.legalAddress || SITE.legalAddress;
  const address = t(settings.contactAddress || "Tà Xùa, Bắc Yên, Sơn La");
  const links = await footerLinks().catch((e) => {
    console.error("footer links", e);
    return { homes: [], places: [] };
  });

  return (
    <footer className="mt-16 bg-forest-900 text-forest-100">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-forest-800">
              TX
            </span>
            <span className="text-lg font-extrabold text-white">{t("Tà Xùa Booking")}</span>
          </div>
          <p className="mt-3 text-sm text-forest-200">{t(SITE.description)}</p>
        </div>

        <div>
          <h4 className="font-semibold text-white">{t("Dịch vụ")}</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {CATEGORY_LIST.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`} className="hover:text-white">
                  {t(c.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white">{t("Liên hệ")}</h4>
          <ul className="mt-3 space-y-2 text-sm text-forest-200">
            <li>📞 {formatPhone(phone)}</li>
            <li>{t("🕗 Giờ hoạt động: {0}", [t(SITE.supportHours)])}</li>
            {email && <li>✉️ {t(email)}</li>}
            <li>{t("📍 Khu vực hoạt động: {0}", [t(address)])}</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white">{t("Khám phá")}</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/huong-dan" className="hover:text-white">{t("Hướng dẫn đặt dịch vụ")}</Link></li>
            <li><Link href="/tra-cuu" className="hover:text-white">{t("Tra cứu đơn đặt")}</Link></li>
            <li><Link href="/lich-trinh" className="hover:text-white">{t("Lịch trình & chi phí")}</Link></li>
            <li><Link href="/ban-do" className="hover:text-white">{t("Bản đồ check-in")}</Link></li>
            <li><Link href="/diem-den" className="hover:text-white">{t("Điểm tham quan Tà Xùa")}</Link></li>
            <li><Link href="/thoi-tiet-ta-xua" className="hover:text-white">{t("Thời tiết Tà Xùa")}</Link></li>
            <li><Link href="/kinh-nghiem" className="hover:text-white">{t("Kinh nghiệm du lịch")}</Link></li>
            <li><Link href="/gioi-thieu" className="hover:text-white">{t("Giới thiệu")}</Link></li>
            <li><Link href="/lien-he"className="hover:text-white">{t("Thông tin liên hệ")}</Link></li>
            <li><Link href="/chinh-sach-bao-mat" className="hover:text-white">{t("Chính sách bảo mật")}</Link></li>
            <li><Link href="/cam-ket/dieu-khoan" className="hover:text-white">{t("Điều khoản & hoàn tiền")}</Link></li>
          </ul>
        </div>
      </div>

      {(links.homes.length > 0 || links.places.length > 0) && (
        <div className="container-page grid gap-6 border-t border-white/10 py-8 text-sm lg:grid-cols-2">
          {links.homes.length > 0 && (
            <div>
              <h4 className="font-semibold text-white">{t("Homestay mới tại Tà Xùa")}</h4>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-forest-200">
                {links.homes.map((h) => (
                  <li key={h.slug}><Link href={`/homestay/${h.slug}`} className="hover:text-white">{t(h.title)}</Link></li>
                ))}
              </ul>
            </div>
          )}
          {links.places.length > 0 && (
            <div>
              <h4 className="font-semibold text-white">{t("Điểm tham quan Tà Xùa")}</h4>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-forest-200">
                {links.places.map((pl) => (
                  <li key={pl.slug}><Link href={`/diem-den/${pl.slug}`} className="hover:text-white">{t(pl.name)}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-white/10 py-5 text-center text-xs leading-relaxed text-forest-300">
        <div className="container-page">
          <p>
            {t("Tà Xùa Booking là nền tảng trung gian đặt dịch vụ du lịch tại Tà Xùa. Homestay, nhà xe và các dịch vụ trên website do chính chủ cơ sở sở hữu và vận hành; tên, hình ảnh thuộc về các cơ sở đó.")}
          </p>
          {(legalName || taxCode) && (
            <p className="mt-1">
              {t(legalName)}
              {legalName && taxCode ? " · " : ""}
              {taxCode && <>MST: {t(taxCode)}</>}
              {t(" · Địa chỉ đăng ký: ")}
              {t(legalAddress)}
            </p>
          )}
          <p className="mt-1">{t("© {0} Tà Xùa Booking. Dịch vụ du lịch Tà Xùa.", [new Date().getFullYear()])}</p>
        </div>
      </div>
    </footer>
  );
}
