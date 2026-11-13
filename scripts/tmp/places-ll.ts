import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.place.findMany({ where: { published: true }, select: { kind: true, name: true, lat: true, lng: true, slug: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
  for (const r of rows) console.log(r.kind, "|", r.name, "|", r.lat, r.lng);
  const hs = await prisma.service.findMany({ where: { category: "HOMESTAY" }, select: { name: true, slug: true, mapUrl: true, address: true } as any }).catch((e) => { console.log("svc err", String(e.message).slice(0, 300)); return []; });
  console.log("homestays", hs.length);
  for (const h of hs.slice(0, 40)) console.log("H |", (h as any).name, "|", (h as any).mapUrl ?? "", "|", (h as any).address ?? "");
})().finally(() => prisma.$disconnect());
