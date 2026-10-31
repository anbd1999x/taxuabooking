import Link from "next/link";
import { CATEGORY_LIST } from "@/lib/constants";
import { SITE } from "@/lib/site";

export function Footer({ settings }: { settings: Record<string, string> }) {
  const phone = settings.contactPhone || SITE.defaultPhone;
  const email = settings.contactEmail || "";
  const facebook = settings.contactFacebook || "";
  const address = settings.contactAddress || "Tà Xùa, Bắc Yên, Sơn La";

  return (
    <footer className="mt-16 bg-forest-900 text-forest-100">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-forest-800">
              TX
            </span>
            <span className="text-lg font-extrabold text-white">Tà Xùa Booking</span>
          </div>
          <p className="mt-3 text-sm text-forest-200">{SITE.description}</p>
        </div>

        <div>
          <h4 className="font-semibold text-white">Dịch vụ</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {CATEGORY_LIST.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`} className="hover:text-white">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white">Liên hệ</h4>
          <ul className="mt-3 space-y-2 text-sm text-forest-200">
            <li>📞 {phone}</li>
            {email && <li>✉️ {email}</li>}
            {facebook && (
              <li>
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  📘 Facebook
                </a>
              </li>
            )}
            <li>📍 {address}</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white">Khám phá</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/huong-dan" className="hover:text-white">Hướng dẫn đặt dịch vụ</Link></li>
            <li><Link href="/tra-cuu" className="hover:text-white">Tra cứu đơn đặt</Link></li>
            <li><Link href="/kinh-nghiem" className="hover:text-white">Kinh nghiệm du lịch</Link></li>
            <li><Link href="/lien-he" className="hover:text-white">Thông tin liên hệ</Link></li>
            <li><Link href="/chinh-sach-bao-mat" className="hover:text-white">Chính sách bảo mật</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-forest-300">
        © {new Date().getFullYear()} Tà Xùa Booking. Dịch vụ du lịch Tà Xùa.
      </div>
    </footer>
  );
}
