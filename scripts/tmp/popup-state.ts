import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.siteSetting.findUnique({ where: { key: "trustPopup" } }).then((r) => { const o = JSON.parse(r?.value ?? "{}"); console.log(r?.updatedAt, JSON.stringify({ enabled: o.enabled, sitePhoneOwner: o.sitePhoneOwner, people: (o.people ?? []).map((p: { name: string; hidden?: boolean }) => [p.name, p.hidden]) })); }).finally(() => prisma.$disconnect());
