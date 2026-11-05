import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const TT = 'cmvximbum000crx27ppk3dlj7';
const START = Date.UTC(2026, 10, 4);   // 2026-11-04
const END = Date.UTC(2027, 2, 31);     // 2027-03-31
const ACTIVE = ['NEW', 'CONTACTING', 'CONFIRMED', 'COMPLETED'];

// 1) Chuyến tương lai hien co
const future = await p.cabinTrip.findMany({
  where: { serviceId: TT, departureDate: { gte: new Date(START) } },
  select: { id: true, departureDate: true, direction: true },
});
const ids = future.map((t) => t.id);
// 2) Chuyen dang co khach dat (giu lai)
const booked = await p.bookingRequest.findMany({
  where: { status: { in: ACTIVE }, OR: [{ cabinTripId: { in: ids } }, { cabinReturnTripId: { in: ids } }] },
  select: { cabinTripId: true, cabinReturnTripId: true },
});
const keepIds = new Set();
for (const b of booked) { if (b.cabinTripId) keepIds.add(b.cabinTripId); if (b.cabinReturnTripId) keepIds.add(b.cabinReturnTripId); }
const keep = future.filter((t) => keepIds.has(t.id));
const keepKey = new Set(keep.map((t) => `${t.departureDate.toISOString().slice(0,10)}|${t.direction}`));
console.log(`Chuyen tuong lai: ${future.length} | giu lai (co khach): ${keep.length}`);

// 3) Xoa cac chuyen tuong lai khong co khach
const delIds = future.filter((t) => !keepIds.has(t.id)).map((t) => t.id);
const del = await p.cabinTrip.deleteMany({ where: { id: { in: delIds } } });
console.log('Da xoa:', del.count);

// 4) Tao lai: moi ngay 1 di (21:30) + 1 ve (12:00), 300k, 22 cho, AVAILABLE
const base = { serviceId: TT, operatorName: 'Nhà xe Tiến Thành', route: 'Hà Nội ↔ Tà Xùa',
  pickupPoint: 'Đón nội thành Hà Nội', dropoffPoint: 'Trung tâm Tà Xùa',
  price: 300000, seatsTotal: 22, seatsAvailable: 22, priceDouble: null, seatsDoubleTotal: 0, seatsDoubleAvailable: 0, status: 'AVAILABLE' };
const rows = [];
for (let t = START; t <= END; t += 86400000) {
  const d = new Date(t); const key = d.toISOString().slice(0,10);
  if (!keepKey.has(`${key}|OUTBOUND`)) rows.push({ ...base, direction: 'OUTBOUND', departureDate: d, departureTime: '21:30' });
  if (!keepKey.has(`${key}|RETURN`)) rows.push({ ...base, direction: 'RETURN', departureDate: d, departureTime: '12:00' });
}
const created = await p.cabinTrip.createMany({ data: rows });
console.log('Da tao moi:', created.count);

// 5) Xac nhan
const g = await p.cabinTrip.groupBy({ by: ['direction','departureTime','price'], where: { serviceId: TT }, _count:{_all:true}, _min:{departureDate:true}, _max:{departureDate:true} });
for (const r of g) console.log(`  ${r.direction} ${r.departureTime} ${r.price?.toString()} x${r._count._all} | ${r._min.departureDate?.toISOString().slice(0,10)}->${r._max.departureDate?.toISOString().slice(0,10)}`);
await p.$disconnect();
