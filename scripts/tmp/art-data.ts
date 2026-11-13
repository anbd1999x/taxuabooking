import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const homes = await prisma.service.findMany({
    where: { category: "HOMESTAY", published: true } as never,
    select: {
      id: true, title: true, slug: true, area: true, distanceKm: true, easyRoad: true,
      images: { select: { url: true }, take: 4 },
      roomTypes: {
        select: {
          name: true, cloudView: true, hasBathtub: true, breakfast: true, heating: true, airCon: true,
          rooms: { select: { name: true, capacity: true, listPrice: true, salePrice: true, priceSat: true, amenities: true } },
          images: { select: { url: true }, take: 2 },
        },
      },
    },
  }).catch(async () => prisma.service.findMany({ where: { category: "HOMESTAY" }, select: { id: true, title: true, slug: true, area: true } }));
  for (const h of homes as any[]) {
    const rooms = (h.roomTypes ?? []).flatMap((t: any) => t.rooms.map((r: any) => ({ ...r, t })));
    const prices = rooms.map((r: any) => Number(r.salePrice ?? r.listPrice)).filter((n: number) => n > 0);
    const sat = rooms.map((r: any) => Number(r.priceSat ?? 0)).filter((n: number) => n > 0);
    console.log(`## ${h.title} | /homestay/${h.slug} | ${h.area} | ${h.distanceKm ?? "?"}km | easyRoad=${h.easyRoad} | rooms=${rooms.length} | ${Math.min(...prices)}-${Math.max(...prices)} | sat ${sat.length ? Math.min(...sat) + "-" + Math.max(...sat) : "-"}`);
    for (const t of h.roomTypes ?? []) console.log(`   [${t.name}] view=${t.cloudView} bon=${t.hasBathtub} an=${t.breakfast} suoi=${t.heating} | ${t.rooms.map((r: any) => `${r.name}(${r.capacity}p ${Number(r.salePrice ?? r.listPrice) / 1000}k)`).join(", ")} | ${t.images.map((i: any) => i.url).join(" ")}`);
    console.log(`   svc imgs: ${(h.images ?? []).map((i: any) => i.url).join(" ")}`);
  }
  const cab = await prisma.cabinPriceRow.findMany({ take: 40 });
  console.log(JSON.stringify(cab.map((c: any) => ({ s: c.serviceId?.slice(0, 6), o: c.origin ?? c.from, t: c.ticketType, p: Number(c.price ?? 0), ...c })).slice(0, 15)));
  const trips = await prisma.cabinTrip.findMany({ take: 6, orderBy: { departureDate: "desc" }, select: { direction: true, departureTime: true, price: true, priceDouble: true, service: { select: { title: true } } } as never }).catch((e) => String(e).slice(0, 300));
  console.log(JSON.stringify(trips));
  const places = await prisma.place.findMany({ select: { kind: true, name: true, area: true, price: true, hours: true, hoursWeekend: true, tags: true, desc: true, images: true } as never }).catch(async () => prisma.place.findMany({ take: 50 }));
  for (const p of places as any[]) console.log("P", p.kind, p.name, "|", p.area, "|", p.price, "|", p.hours, p.hoursWeekend ?? "", "|", p.tags, "|", (p.desc ?? "").slice(0, 120), "|", JSON.stringify(p.images ?? p.image ?? "").slice(0, 120));
}
main().finally(() => prisma.$disconnect());
(async () => { const r = await prisma.cabinRoute.findMany({ include: { stops: { orderBy: { sortOrder: "asc" } }, service: { select: { title: true } } } as never }); for (const x of r as any[]) console.log("R", x.service?.title, x.direction, (x.stops as any[]).map((s) => `${s.time} ${s.place}${s.tag ? "(" + s.tag + ")" : ""}`).join(" > ")); })();
