import { prisma } from "../../src/lib/prisma";
import { stayStrike } from "../../src/lib/availability";
import { enumerateNights, toDateKey } from "../../src/lib/dates";
import { getHolidays } from "../../src/lib/holidays-server";
async function main() {
  const hol = await getHolidays();
  for (const code of ["TX-CB-P6CU5", "TX-CB-BW8CE", "TX-QHWS2C"]) {
    const b = (await prisma.bookingRequest.findUnique({ where: { code }, include: { service: true } }))!;
    const ids = b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : [];
    const rooms = await prisma.room.findMany({ where: { id: { in: ids } }, include: { roomType: true } });
    const n = enumerateNights(b.useDate, b.endDate!);
    console.log(`== ${code} ${b.service?.title} nights=${n.map(toDateKey)} room=${b.roomAmount} sur=${JSON.stringify(b.surcharges)} q=${b.quantity} extraFee=${b.service?.extraPersonFee}`);
    for (const r of rooms) console.log(r.roomType.name, r.name, { cap: r.capacity, list: +r.listPrice, sale: r.salePrice && +r.salePrice, hol: r.holidayPrice && +r.holidayPrice, d: [r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map((x) => x && +x), l: [r.listPriceMon, r.listPriceTue, r.listPriceWed, r.listPriceThu, r.listPriceFri, r.listPriceSat, r.listPriceSun].map((x) => x && +x) }, stayStrike(n, r, hol));
  }
}
main().finally(() => prisma.$disconnect());
