import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const slug of ["nha-xe-quang-nghia-2","nha-xe-tien-thanh"]) {
  const s = await p.service.findUnique({ where: { slug }, include: { cabinTrips: { take: 4, orderBy: { departureDate: "desc" } } } });
  console.log("=====", slug, "\n", s.description, "\nPOLICY:", s.policy, "\nPRICEUNIT", s.priceUnit);
  for (const t of s.cabinTrips) console.log("TRIP", t.direction, t.departureDate.toISOString().slice(0,10), t.departureTime, "price", t.price, "dbl", t.priceDouble, t.pickupPoint, "->", t.dropoffPoint);
}
const a = await p.article.findUnique({ where: { slug: "review-nha-xe-khanh-chau-ta-xua" } });
console.log("=====ARTICLE", a.title, "\nEXCERPT", a.excerpt, "\nCOVER", a.coverImage, "\n", a.content);
await p.$disconnect();
