import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findUnique({ where: { slug: "ta-xua-clouds-homestay" }, select: { _count: { select: { images: true } }, roomTypes: { orderBy: { sortOrder: "asc" }, select: { name: true, _count: { select: { images: true } }, rooms: { orderBy: { sortOrder: "asc" }, select: { name: true, _count: { select: { images: true } } } } } } } });
console.log("gallery", s._count.images);
for (const t of s.roomTypes) console.log(t.name, "hạng:", t._count.images, "|", t.rooms.map((r) => `${r.name}:${r._count.images}`).join(" "));
await p.$disconnect();
