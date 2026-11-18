import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const SID = "cmwlzyuba0000unl0tfyhyipu";
const rt = await p.roomType.findFirst({ where: { serviceId: SID, name: "Family 8 (F8)" }, include: { rooms: { select: { id: true, name: true } } } });
if (!rt) { console.log("không còn hạng này"); process.exit(0); }
const ids = rt.rooms.map((r) => r.id);
const bookings = await p.bookingRequest.count({ where: { OR: [{ roomId: { in: ids } }, { roomIds: { hasSome: ids } }, { roomTypeId: rt.id }] } }).catch(async () => p.bookingRequest.count({ where: { OR: [{ roomId: { in: ids } }, { roomIds: { hasSome: ids } }] } }));
console.log("đơn đặt liên quan:", bookings);
if (bookings > 0) process.exit(1);
await p.roomType.delete({ where: { id: rt.id } });
const s = await p.service.findUnique({ where: { id: SID }, select: { description: true, policy: true, summary: true } });
const description = s.description.replace("Home có 20 phòng:", "Home có 19 phòng:").replace("- **Family 8 người**: 4 giường pallet, view sân lửa trại.\n", "");
const policy = s.policy.split("\n").filter((l) => !l.startsWith("- Family 8 người (")).join("\n");
await p.service.update({ where: { id: SID }, data: { description, policy } });
console.log("đã xoá; mô tả đổi:", description !== s.description, "chính sách đổi:", policy !== s.policy);
console.log((await p.roomType.findMany({ where: { serviceId: SID }, orderBy: { sortOrder: "asc" }, select: { name: true, _count: { select: { rooms: true } } } })).map((t) => `${t.name}(${t._count.rooms})`).join(", "));
await p.$disconnect();
