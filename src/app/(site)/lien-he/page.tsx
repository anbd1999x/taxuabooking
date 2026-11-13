import type { Metadata } from "next";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Liên hệ Tà Xùa Booking: hotline, Zalo đặt xe, đặt phòng",
  description: "Liên hệ Tà Xùa Booking qua hotline, Zalo để được tư vấn và đặt xe cabin, homestay, combo đi Tà Xùa. Hỗ trợ xem chỗ trống, báo giá và xác nhận đơn nhanh.",
  alternates: { canonical: "/lien-he" },
};

export default async function ContactPage() {
  const s = await getSettings();
  const phone = s.contactPhone || SITE.defaultPhone;
  const zalo = s.contactZalo || SITE.defaultZalo;
  const email = s.contactEmail;
  const facebook = s.contactFacebook;
  const address = s.contactAddress || "Tà Xùa, Bắc Yên, Sơn La";

  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Thông tin liên hệ</h1>
      <p className="mt-2 text-gray-600">
        Chúng tôi luôn sẵn sàng hỗ trợ bạn đặt xe, phòng và combo du lịch Tà Xùa.
      </p>

      <div className="mt-6 space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p><span className="text-gray-500">📞 Điện thoại: </span><a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-forest-700">{phone}</a></p>
        {zalo && <p><span className="text-gray-500">💬 Zalo: </span><a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700">{zalo}</a></p>}
        {email && <p><span className="text-gray-500">✉️ Email: </span><a href={`mailto:${email}`} className="font-semibold text-forest-700">{email}</a></p>}
        {facebook && <p><span className="text-gray-500">📘 Facebook: </span><a href={facebook} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700">{facebook}</a></p>}
        <p><span className="text-gray-500">📍 Địa chỉ: </span>{address}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-xl bg-forest-600 px-5 py-3 font-semibold text-white hover:bg-forest-700">Gọi ngay</a>
        {zalo && <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-sunset-500 px-5 py-3 font-semibold text-white hover:bg-sunset-600">Chat Zalo</a>}
      </div>
    </div>
  );
}
