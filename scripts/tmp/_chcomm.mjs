import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const where = { roomType: { serviceId: "cmwlsv2li0000unncr6citxcn" } };
const r = await p.room.updateMany({ where, data: { commission: 100000, commissionMon: null, commissionTue: null, commissionWed: null, commissionThu: null, commissionFri: null, commissionSat: null, commissionSun: null } });
console.log("đã cập nhật", r.count);
for (const x of await p.room.findMany({ where, orderBy: { sortOrder: "asc" } })) console.log(x.name, String(x.commission), [x.commissionMon, x.commissionSat, x.commissionSun].map(String).join(","));
await p.$disconnect();
