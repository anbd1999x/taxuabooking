import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./auth";
import { prisma } from "./prisma";

/**
 * Chủ homestay TỰ ĐĂNG KÝ dùng thử (AdminUser.selfSignup, vai trò PROVIDER): được tự tạo / sửa homestay CỦA MÌNH
 * ở /admin/services. Admin duyệt = bật Service.published (chỉ quyết định có hiện trên website hay không,
 * không ảnh hưởng chức năng quản lý của chủ).
 *
 * Server action là endpoint công khai ⇒ mọi action sửa dịch vụ phải gọi một trong các hàm require* dưới đây
 * (thay cho requireAdmin) để chặn sửa dịch vụ của người khác.
 */

export interface ServiceEditor {
  session: SessionPayload;
  /** true = admin (toàn quyền); false = chủ tự đăng ký (chỉ dịch vụ của mình, không đổi trường của sàn). */
  isAdmin: boolean;
}

const DENY = "Không có quyền thực hiện thao tác này.";

/** Đã đăng nhập là chủ homestay tự đăng ký (selfSignup) — dùng cho trang / menu. */
export async function isSelfSignupProvider(s: SessionPayload | null): Promise<boolean> {
  if (!s || s.role !== "PROVIDER") return false;
  const u = await prisma.adminUser.findUnique({ where: { id: s.sub }, select: { selfSignup: true, active: true } });
  return !!(u?.active && u.selfSignup);
}

/** Cho TRANG /admin/services*: admin hoặc chủ tự đăng ký; người khác (chủ cũ, CTV…) về khu của mình. */
export async function servicePageAccess(serviceId?: string): Promise<ServiceEditor> {
  const s = await getSession();
  if (s?.role === "ADMIN") return { session: s, isAdmin: true };
  if (!s || !(await isSelfSignupProvider(s))) redirect(s?.role === "PROVIDER" ? "/admin/provider" : "/admin/login");
  if (serviceId) {
    const svc = await prisma.service.findUnique({ where: { id: serviceId }, select: { ownerId: true, category: true } });
    if (!svc || svc.ownerId !== s.sub || (svc.category !== "HOMESTAY" && svc.category !== "BUNGALOW")) redirect("/admin/services");
  }
  return { session: s, isAdmin: false };
}

/** Admin hoặc chủ tự đăng ký (chưa gắn dịch vụ cụ thể) — dùng cho tạo mới / danh sách. */
export async function requireServiceManager(): Promise<ServiceEditor> {
  const s = await getSession();
  if (s?.role === "ADMIN") return { session: s, isAdmin: true };
  if (s && (await isSelfSignupProvider(s))) return { session: s, isAdmin: false };
  throw new Error(DENY);
}

/** Admin, hoặc chủ tự đăng ký SỞ HỮU dịch vụ này (chỉ homestay). */
export async function requireServiceEditor(serviceId: string | null | undefined): Promise<ServiceEditor> {
  const ed = await requireServiceManager();
  if (ed.isAdmin) return ed;
  if (!serviceId) throw new Error(DENY);
  const svc = await prisma.service.findUnique({ where: { id: serviceId }, select: { ownerId: true, category: true } });
  if (!svc || svc.ownerId !== ed.session.sub || (svc.category !== "HOMESTAY" && svc.category !== "BUNGALOW")) throw new Error(DENY);
  return ed;
}

/** Tra dịch vụ của các thực thể con (để kiểm quyền theo id con trong form). */
export async function serviceIdOfRoomType(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.roomType.findUnique({ where: { id }, select: { serviceId: true } }))?.serviceId ?? null;
}
export async function serviceIdOfRoom(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.room.findUnique({ where: { id }, select: { roomType: { select: { serviceId: true } } } }))?.roomType.serviceId ?? null;
}
export async function serviceIdOfServiceImage(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.serviceImage.findUnique({ where: { id }, select: { serviceId: true } }))?.serviceId ?? null;
}
export async function serviceIdOfRoomTypeImage(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.roomTypeImage.findUnique({ where: { id }, select: { roomType: { select: { serviceId: true } } } }))?.roomType.serviceId ?? null;
}
export async function serviceIdOfRoomImage(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.roomImage.findUnique({ where: { id }, select: { room: { select: { roomType: { select: { serviceId: true } } } } } }))?.room.roomType.serviceId ?? null;
}
export async function serviceIdOfIcalSource(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.roomIcalSource.findUnique({ where: { id }, select: { room: { select: { roomType: { select: { serviceId: true } } } } } }))?.room.roomType.serviceId ?? null;
}

/**
 * Kiểm quyền theo NHIỀU dịch vụ cùng lúc (id cha trong form + dịch vụ thật của bản ghi con): admin qua luôn;
 * chủ tự đăng ký phải sở hữu TẤT CẢ (thiếu id = từ chối) — chặn gửi id con của mình kèm serviceId người khác.
 */
export async function guard(...serviceIds: (string | null | undefined)[]): Promise<ServiceEditor> {
  const ed = await requireServiceManager();
  if (ed.isAdmin) return ed;
  if (!serviceIds.length) throw new Error(DENY);
  for (const id of serviceIds) await requireServiceEditor(id);
  return ed;
}
