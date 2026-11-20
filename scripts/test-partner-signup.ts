/**
 * Kiểm thử luồng chủ homestay TỰ ĐĂNG KÝ dùng thử (DB thật, tự dọn):
 * đăng nhập Google (tự tạo tài khoản lần đầu) → tạo homestay (ẩn, chờ duyệt) → sửa giá / phòng → không đụng được homestay người khác
 * → không đổi được trường của sàn (hiển thị, nổi bật, chiết khấu) → đăng nhập lại đúng tài khoản cũ.
 *
 *   npx tsx --tsconfig scripts/tsconfig.route-test.json --env-file=.env scripts/test-partner-signup.ts
 */
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-token";
import { loginPartnerWithGoogle } from "@/lib/partner-auth";
import { loginAction } from "@/app/admin/login/actions";
import { createServiceFull, updateService, upsertRoomType, upsertRoom, deleteRoom, applyRoomTypePrices, toggleField } from "@/app/admin/services/actions";
import { POST as uploadPOST } from "@/app/api/admin/upload/route";

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
}
const jar = () => ((globalThis as unknown as { __testCookies: Record<string, string> }).__testCookies ??= {});
const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
/** Gọi server action: redirect() ném NEXT_REDIRECT (coi là thành công, trả url); revalidatePath ngoài Next thì bỏ qua. */
async function call<T>(fn: () => Promise<T>): Promise<{ value?: T; redirect?: string; error?: string }> {
  try {
    return { value: await fn() };
  } catch (e) {
    const err = e as { digest?: string; message?: string };
    if (err.digest?.startsWith("NEXT_REDIRECT")) return { redirect: err.digest.split(";")[2] };
    if (/static generation store|revalidate|workStore|Invariant/i.test(err.message ?? "")) return { value: undefined };
    return { error: err.message };
  }
}

async function main() {
  const stamp = Date.now();
  const email = `thu-${stamp}@example.com`;
  const email2 = `thu2-${stamp}@example.com`;
  const made = { users: [] as string[], services: [] as string[] };
  try {
    console.log("· Đăng nhập Google lần đầu (tự tạo tài khoản)");
    let r: { value?: unknown; redirect?: string; error?: string } = {};
    let g = await loginPartnerWithGoogle({ email: email.toUpperCase(), name: "Chủ Thử" });
    ok("next" in g && g.next === "/admin/provider", "lần đầu → chuyển tới Tổng quan (4 chức năng)", g);
    const u1 = await prisma.adminUser.findUnique({ where: { username: email } });
    ok(u1?.selfSignup && u1.role === "PROVIDER" && u1.email === email, "tạo tài khoản PROVIDER selfSignup, email chữ thường", u1);
    if (u1) made.users.push(u1.id);
    const s1 = await verifySessionToken(jar()[AUTH_COOKIE_NAME] ?? "");
    ok(s1?.sub === u1?.id && s1?.role === "PROVIDER", "đăng nhập luôn");

    console.log("· Đăng nhập lại");
    jar()[AUTH_COOKIE_NAME] = "";
    g = await loginPartnerWithGoogle({ email, name: "Tên khác" });
    const s1b = await verifySessionToken(jar()[AUTH_COOKIE_NAME] ?? "");
    ok("next" in g && s1b?.sub === u1?.id && (await prisma.adminUser.count({ where: { email } })) === 1, "lần sau vào lại ĐÚNG tài khoản cũ, không tạo trùng", g);
    r = await call(() => loginAction({}, fd({ username: email, password: "" })));
    ok(!r.redirect, "không đăng nhập mật khẩu được (tài khoản Google)", r);
    await prisma.adminUser.update({ where: { id: u1!.id }, data: { active: false } });
    g = await loginPartnerWithGoogle({ email, name: "" });
    ok("error" in g && g.error === "locked", "tài khoản bị khoá ⇒ từ chối", g);
    await prisma.adminUser.update({ where: { id: u1!.id }, data: { active: true } });

    g = await loginPartnerWithGoogle({ email: email2, name: "Chủ Hai" });
    const u2 = await prisma.adminUser.findUnique({ where: { username: email2 } });
    ok("next" in g && u2?.selfSignup, "chủ thứ hai đăng nhập Google", g);
    if (u2) made.users.push(u2.id);

    console.log("· Tạo homestay (chủ 2)");
    // phiên hiện tại = chủ 2 (SĐT)
    r = await call(() => createServiceFull({}, fd({ category: "HOMESTAY", title: `Home thử ${stamp}`, summary: "Homestay thử nghiệm view mây", description: "Mô tả chi tiết homestay thử nghiệm cho kiểm thử tự động.", published: "on", featured: "on", ownerId: u1!.id, roomCommission: "99000", roomName: ["Phòng đôi"], roomCapacity: ["2"], roomWeekday: ["500000"], roomWeekend: ["700000"], roomTotal: ["1"] })));
    const svc = await prisma.service.findFirst({ where: { title: `Home thử ${stamp}` } });
    if (svc) made.services.push(svc.id);
    // (ngoài Next, revalidatePath ném lỗi trước redirect ⇒ chỉ kiểm bản ghi được tạo)
    ok(svc && (r.redirect === `/admin/services/${svc.id}` || !r.error), "tạo homestay được", r);
    ok(svc && !svc.published && !svc.featured && svc.ownerId === u2!.id && svc.roomCommission == null, "homestay mới: ẩn (chờ duyệt), không nổi bật, chủ = mình, không chiết khấu", svc);
    r = await call(() => createServiceFull({}, fd({ category: "CABIN", title: `Xe thử ${stamp}`, summary: "Nhà xe thử nghiệm tự động", description: "Mô tả chi tiết nhà xe thử nghiệm cho kiểm thử." })));
    ok((r.value as { error?: string })?.error?.includes("chỉ tạo được homestay"), "không tạo được nhà xe", r);

    console.log("· Sửa homestay của mình");
    r = await call(() => updateService({}, fd({ id: svc!.id, category: "CABIN", title: `Home thử sửa ${stamp}`, summary: "Homestay thử nghiệm view mây 2", description: "Mô tả chi tiết homestay thử nghiệm cho kiểm thử tự động 2.", published: "on", featured: "on", roomCommission: "50000", priorityOrder: "9", extraPersonFee: "150000" })));
    const svc2 = await prisma.service.findUnique({ where: { id: svc!.id } });
    ok(svc2?.title === `Home thử sửa ${stamp}` && Number(svc2.extraPersonFee) === 150000, "sửa tên / phụ thu được", { r, svc2 });
    ok(svc2 && !svc2.published && !svc2.featured && svc2.category === "HOMESTAY" && svc2.roomCommission == null && svc2.priorityOrder === 0, "không tự bật hiển thị / nổi bật / đổi loại / chiết khấu", svc2);

    const rt = await prisma.roomType.findFirst({ where: { serviceId: svc!.id } });
    r = await call(() => upsertRoomType({}, fd({ serviceId: svc!.id, name: "Hạng VIP", capacity: "2" })));
    ok(await prisma.roomType.count({ where: { serviceId: svc!.id, name: "Hạng VIP" } }), "thêm hạng phòng", r);
    r = await call(() => upsertRoom({}, fd({ serviceId: svc!.id, roomTypeId: rt!.id, name: "P101", capacity: "2", listPrice: "600000", priceSat: "800000", commission: "70000", featured: "on" })));
    const room = await prisma.room.findFirst({ where: { roomTypeId: rt!.id, name: "P101" } });
    ok(room && Number(room.listPrice) === 600000 && Number(room.priceSat) === 800000, "thêm phòng + giá theo thứ", { r, room });
    ok(room && room.commission == null && !room.featured, "không tự đặt chiết khấu / phòng nổi bật", room);
    r = await call(() => applyRoomTypePrices({}, fd({ roomTypeId: rt!.id, serviceId: svc!.id, listPrice: "650000" })));
    ok(Number((await prisma.room.findUnique({ where: { id: room!.id } }))?.listPrice) === 650000, "áp giá cả hạng", r);

    console.log("· Không đụng được homestay người khác");
    const other = await prisma.service.findFirst({ where: { category: "HOMESTAY", ownerId: { not: u2!.id } }, include: { roomTypes: { take: 1, include: { rooms: { take: 1 } } } } });
    if (other) {
      const before = await prisma.service.findUnique({ where: { id: other.id }, select: { title: true, updatedAt: true } });
      r = await call(() => updateService({}, fd({ id: other.id, category: "HOMESTAY", title: "HACK", summary: "Homestay thử nghiệm view mây", description: "Mô tả chi tiết homestay thử nghiệm cho kiểm thử tự động." })));
      ok(r.error && (await prisma.service.findUnique({ where: { id: other.id } }))?.title === before?.title, "sửa homestay người khác bị chặn", r);
      const orm = other.roomTypes[0]?.rooms[0];
      if (orm) {
        r = await call(() => deleteRoom(fd({ id: orm.id, serviceId: svc!.id })));
        ok(r.error && (await prisma.room.findUnique({ where: { id: orm.id } })), "xoá phòng người khác (kèm serviceId của mình) bị chặn", r);
        r = await call(() => upsertRoom({}, fd({ serviceId: svc!.id, roomTypeId: other.roomTypes[0].id, name: "Chen", capacity: "2" })));
        ok(r.error && !(await prisma.room.findFirst({ where: { roomTypeId: other.roomTypes[0].id, name: "Chen" } })), "thêm phòng vào hạng người khác bị chặn", r);
      }
      r = await call(() => toggleField(fd({ id: svc!.id, field: "published" })));
      ok(r.error && !(await prisma.service.findUnique({ where: { id: svc!.id } }))?.published, "chủ không tự bật hiển thị (toggle chỉ admin)", r);
    }

    console.log("· Tải ảnh");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const up = async (extra: Record<string, string>) => {
      const f = new FormData();
      f.append("file", new File([png], "a.png", { type: "image/png" }));
      for (const [k, v] of Object.entries(extra)) f.append(k, v);
      const body = new Response(f);
      const buf = await body.arrayBuffer();
      const res = await uploadPOST(new Request("http://x/api/admin/upload", { method: "POST", body: buf, headers: { "content-type": body.headers.get("content-type")!, "content-length": String(buf.byteLength) } }));
      return res.status;
    };
    ok((await up({ serviceId: svc!.id })) === 201, "tải ảnh cho homestay của mình");
    if (other) ok((await up({ serviceId: other.id })) === 403, "tải ảnh vào homestay người khác bị chặn");
    ok((await up({ standalone: "1" })) === 403, "không tải tệp lẻ (standalone)");
  } finally {
    const imgs = await prisma.serviceImage.findMany({ where: { serviceId: { in: made.services } }, select: { url: true } });
    await prisma.service.deleteMany({ where: { id: { in: made.services } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: made.users } } });
    const fs = await import("node:fs");
    for (const i of imgs) if (i.url.startsWith("/uploads/")) fs.rmSync(`public${i.url}`, { force: true });
    console.log(`\n${pass} đạt, ${fail} lỗi`);
    await prisma.$disconnect();
    if (fail) process.exitCode = 1;
  }
}
main();
