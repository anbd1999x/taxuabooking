import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.bookingRequest.findFirst({ where: { category: "COMBO" }, orderBy: { createdAt: "desc" }, select: { code: true, useDate: true, endDate: true, nights: true, selectionLabel: true, cabinTripId: true } }).then(async (b) => { const t = b?.cabinTripId ? await prisma.cabinTrip.findUnique({ where: { id: b.cabinTripId }, select: { departureDate: true } }) : null; console.log(JSON.stringify(b), "xe đi:", t?.departureDate); }).finally(() => prisma.$disconnect());
