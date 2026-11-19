/**
 * Kiểm thử luồng ĐỐI TÁC TỰ TẠO địa điểm vé / đặt bàn → gửi duyệt → admin duyệt / từ chối.
 * Gọi thẳng route POST /api/admin/ticket với cookie phiên ký sẵn (stub next/headers); tạo chủ thử + địa điểm thử, TỰ DỌN.
 *   npx tsx --tsconfig scripts/tsconfig.route-test.json --env-file=.env scripts/test-venue-review.ts
 */
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, createSessionToken, type Role } from "@/lib/auth-token";
import { publicVenue, publicVenueCards } from "@/lib/ticket";
import type { TkData } from "@/lib/ticket-core";
import { POST } from "@/app/api/admin/ticket/route";

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
}
async function as(role: Role, sub: string) {
  const token = await createSessionToken({ sub, role, username: "kiem-thu", name: "Kiểm thử" });
  (globalThis as unknown as { __testCookies: Record<string, string> }).__testCookies = { [AUTH_COOKIE_NAME]: token };
}
type Res = { status: number; error?: string; message?: string } & Partial<TkData>;
async function api(body: Record<string, unknown>): Promise<Res> {
  const res = await POST(new Request("http://x/api/admin/ticket", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, ...(await res.json()) };
}
const isListed = async (slug: string) => (await publicVenueCards()).cards.some((c) => c.slug === slug);

async function main() {
  const stamp = Date.now();
  const users: string[] = [];
  const venues: string[] = [];
  try {
    const owner = await prisma.adminUser.create({ data: { username: `test-ve-chu-${stamp}`, name: "Chủ quán thử", role: "PROVIDER", passwordHash: "x" } });
    const other = await prisma.adminUser.create({ data: { username: `test-ve-khac-${stamp}`, name: "Chủ khác", role: "PROVIDER", passwordHash: "x" } });
    const admin = await prisma.adminUser.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
    users.push(owner.id, other.id);
    if (!admin) throw new Error("Không có tài khoản ADMIN để thử.");

    // ---------- Đối tác tự tạo ----------
    await as("PROVIDER", owner.id);
    const c = await api({ op: "createVenue", kind: "RESTAURANT", name: `ZZ Test Nhà hàng ${stamp}`, ownerId: other.id });
    const id = c.venue?.id ?? "";
    if (id) venues.push(id);
    ok(c.status === 200 && c.venue?.review === "draft", "đối tác tạo nhà hàng ⇒ bản nháp", c);
    ok(c.venue?.ownerId === owner.id, "chủ = chính đối tác (bỏ qua ownerId gửi lên)", c.venue?.ownerId);
    const slug = c.venue?.slug ?? "";

    const pub = await api({ op: "saveVenue", venueId: id, name: c.venue?.name, published: true });
    ok(pub.status === 200 && pub.venue?.published === false, "chưa duyệt: tick mở bán bị bỏ qua", pub.venue?.published);
    ok(!(await isListed(slug)) && !(await publicVenue(slug)), "bản nháp không hiện ở /ve");

    const s0 = await api({ op: "submitReview", venueId: id });
    ok(s0.status === 400 && /bàn/.test(s0.error ?? ""), "nhà hàng chưa có bàn ⇒ chưa gửi duyệt được", s0);
    await api({ op: "saveTable", venueId: id, table: { name: "B1", cap: 4, zone: "Trong nhà" } });
    const s1 = await api({ op: "submitReview", venueId: id });
    ok(s1.status === 200 && s1.venue?.review === "pending" && s1.venue.submittedAt, "có bàn ⇒ gửi duyệt ⇒ chờ duyệt", s1);
    ok(!(await isListed(slug)), "chờ duyệt vẫn chưa hiện ở /ve");
    ok((await api({ op: "approveVenue", venueId: id })).status === 403, "đối tác không tự duyệt được");

    const w = await api({ op: "withdrawReview", venueId: id });
    ok(w.venue?.review === "draft", "rút lại ⇒ về nháp", w.venue?.review);
    await api({ op: "submitReview", venueId: id });

    // Chủ khác không đụng được
    await as("PROVIDER", other.id);
    ok((await api({ op: "reload", venueId: id })).status === 403, "chủ khác không xem / sửa được địa điểm");

    // ---------- Admin từ chối ----------
    await as("ADMIN", admin.id);
    ok((await api({ op: "rejectVenue", venueId: id, note: "" })).status === 400, "từ chối phải có lý do");
    const r = await api({ op: "rejectVenue", venueId: id, note: "Thiếu ảnh bìa" });
    ok(r.venue?.review === "rejected" && r.venue.reviewNote === "Thiếu ảnh bìa" && !r.venue.published, "admin từ chối ⇒ rejected + lý do", r.venue);

    await as("PROVIDER", owner.id);
    const s2 = await api({ op: "submitReview", venueId: id });
    ok(s2.venue?.review === "pending" && s2.venue.reviewNote === "", "đối tác gửi duyệt lại ⇒ xoá lý do cũ", s2.venue);

    // ---------- Admin duyệt ----------
    await as("ADMIN", admin.id);
    const a = await api({ op: "approveVenue", venueId: id });
    ok(a.venue?.review === "approved" && a.venue.published, "admin duyệt ⇒ approved + mở bán", a.venue);
    ok((await isListed(slug)) && !!(await publicVenue(slug)), "đã duyệt ⇒ hiện ở /ve");

    // Sau duyệt: đối tác tự bật / tắt được
    await as("PROVIDER", owner.id);
    const off = await api({ op: "saveVenue", venueId: id, name: a.venue?.name, published: false });
    ok(off.venue?.published === false && !(await isListed(slug)), "đã duyệt: đối tác tắt mở bán ⇒ ẩn khỏi /ve");
    const on = await api({ op: "saveVenue", venueId: id, name: a.venue?.name, published: true });
    ok(on.venue?.published === true && (await isListed(slug)), "đã duyệt: đối tác bật lại ⇒ hiện");
    ok((await api({ op: "deleteVenue", venueId: id })).status === 403, "đối tác không xoá được địa điểm đã duyệt");

    // Bản nháp: đối tác xoá được
    const d = await api({ op: "createVenue", kind: "SHOW", name: `ZZ Test Show ${stamp}` });
    if (d.venue?.id) venues.push(d.venue.id);
    ok(d.venue?.review === "draft", "đối tác tạo show ⇒ nháp");
    const del = await api({ op: "deleteVenue", venueId: d.venue?.id });
    ok(del.status === 200, "đối tác xoá bản nháp của mình", del);

    // Admin tạo ⇒ duyệt sẵn; admin bật mở bán địa điểm nháp ⇒ duyệt luôn
    await as("ADMIN", admin.id);
    const g = await api({ op: "createVenue", kind: "GATE", name: `ZZ Test Cổng ${stamp}`, ownerId: owner.id });
    if (g.venue?.id) venues.push(g.venue.id);
    ok(g.venue?.review === "approved" && g.venue.ownerId === owner.id, "admin tạo ⇒ duyệt sẵn, gán chủ", g.venue);
    await as("PROVIDER", owner.id);
    const n = await api({ op: "createVenue", kind: "GATE", name: `ZZ Test Cổng nháp ${stamp}` });
    if (n.venue?.id) venues.push(n.venue.id);
    await as("ADMIN", admin.id);
    const np = await api({ op: "saveVenue", venueId: n.venue?.id, name: n.venue?.name, published: true });
    ok(np.venue?.review === "approved" && np.venue.published, "admin tick mở bán bản nháp ⇒ duyệt luôn", np.venue);

    // STAFF không tạo được
    const staff = await prisma.adminUser.create({ data: { username: `test-ve-nv-${stamp}`, name: "NV", role: "STAFF", providerId: owner.id, passwordHash: "x" } });
    users.push(staff.id);
    await as("STAFF", staff.id);
    ok((await api({ op: "createVenue", kind: "GATE", name: "x nhân viên" })).status === 403, "nhân viên không tạo được địa điểm");
  } finally {
    await prisma.ticketVenue.deleteMany({ where: { id: { in: venues } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: users } } });
    console.log(`\nDọn dữ liệu thử: ${venues.length} địa điểm, ${users.length} tài khoản.`);
  }
  console.log(`\n${pass} đạt, ${fail} lỗi.`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
