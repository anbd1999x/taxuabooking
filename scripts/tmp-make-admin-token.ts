// Tạo cookie phiên ADMIN để curl trang admin khi kiểm thử: npx tsx scripts/tmp-make-admin-token.ts
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const admin = await prisma.adminUser.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user");
  const token = await new SignJWT({ username: admin.username, name: admin.name, role: "ADMIN" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime("3600s")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  console.log(token);
  await prisma.$disconnect();
}
main();
