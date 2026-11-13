import { PrismaClient } from "@prisma/client";
import { resolveMapLatLng, geocodeByName } from "../../src/lib/map-link";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
async function main() {
  const r = await prisma.place.findMany({ where: { kind: "CHECKIN" }, select: { id: true, slug: true, name: true, mapUrl: true, lat: true, lng: true }, orderBy: { sortOrder: "asc" } });
  for (const p of r) {
    let src = "link";
    let ll = await resolveMapLatLng(p.mapUrl);
    if (!ll && !p.mapUrl) { ll = await geocodeByName(`${p.name}, Tà Xùa, Sơn La`); src = "tên"; }
    console.log(p.slug, "|", p.name, "|", ll ? `${ll.lat}, ${ll.lng} (${src})` : "— KHÔNG LẤY ĐƯỢC");
    if (APPLY && ll && p.lat == null) await prisma.place.update({ where: { id: p.id }, data: { lat: ll.lat, lng: ll.lng } });
  }
  for (const n of ["UBND xã Tà Xùa, Bắc Yên, Sơn La", "Chợ Tà Xùa, Sơn La", "Thị trấn Bắc Yên, Sơn La", "Bến xe Bắc Yên, Sơn La"]) console.log("MỐC", n, JSON.stringify(await geocodeByName(n)));
}
main().finally(() => prisma.$disconnect());
