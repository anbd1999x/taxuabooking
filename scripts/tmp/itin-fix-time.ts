import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const row = await prisma.siteSetting.findUnique({ where: { key: "itinerary" } });
  if (!row) throw new Error("no itinerary");
  const cfg = JSON.parse(row.value);
  const plan = cfg.plans.find((p: any) => p.id === "2n1d");
  const stops = plan.days[1].stops;
  const s = stops[stops.length - 1];
  console.log("trước:", s.time, "|", s.name);
  if (!/trả Hà Nội/.test(s.name) || s.time !== "08:00") throw new Error("điểm dừng không như mong đợi, không sửa");
  s.time = "19:00";
  s.name = s.name.replace(/^Đểm/, "Điểm");
  await prisma.siteSetting.update({ where: { key: "itinerary" }, data: { value: JSON.stringify(cfg) } });
  console.log("sau:", s.time, "|", s.name);
})().finally(() => prisma.$disconnect());
