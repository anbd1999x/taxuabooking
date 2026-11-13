import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const arts = await prisma.article.findMany({ where: { published: true }, select: { slug: true, title: true, topic: true }, orderBy: { createdAt: "asc" } });
  console.log("ARTICLES", arts.length); for (const a of arts) console.log(` ${a.topic} | ${a.slug} | ${a.title}`);
  const svc = await prisma.service.findMany({ where: { published: true }, select: { category: true, slug: true, title: true, basePrice: true, images: { select: { url: true }, take: 2, orderBy: { sortOrder: "asc" } } } });
  const by: Record<string, typeof svc> = {}; for (const s of svc) (by[s.category] ??= []).push(s);
  for (const [c, l] of Object.entries(by)) { const pr = l.map((s) => Number(s.basePrice ?? 0)).filter(Boolean); console.log("CAT", c, l.length, "price", Math.min(...pr), Math.max(...pr)); for (const s of l.slice(0, c === "HOMESTAY" ? 8 : 6)) console.log("   ", s.slug, "|", s.title, "|", Number(s.basePrice ?? 0), "|", s.images[0]?.url ?? ""); }
  const rooms = await prisma.room.findMany({ where: { roomType: { service: { published: true, category: "HOMESTAY" } } }, select: { listPrice: true, salePrice: true, name: true } });
  const rp = rooms.map((r) => Number(r.salePrice ?? r.listPrice ?? 0)).filter((v) => v > 0).sort((a, b) => a - b);
  console.log("ROOMS", rp.length, "min", rp[0], "p25", rp[Math.floor(rp.length * .25)], "median", rp[Math.floor(rp.length / 2)], "p75", rp[Math.floor(rp.length * .75)], "max", rp[rp.length - 1]);
  const cab = await prisma.cabinPriceRow.findMany({ select: { serviceId: true, ticketType: true, price: true, origin: true } as never }).catch(async () => prisma.cabinPriceRow.findMany({ take: 12 }));
  console.log("CABIN", JSON.stringify(cab.slice(0, 12)));
  const places = await prisma.place.findMany({ where: { published: true }, select: { kind: true, slug: true, name: true, price: true, hours: true, address: true, coverImage: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  for (const p of places) console.log("PLACE", p.kind, "|", p.slug, "|", p.name, "|", p.price, "|", p.hours, "|", p.address ?? "", "|", p.coverImage ?? "");
}
main().finally(() => prisma.$disconnect());
