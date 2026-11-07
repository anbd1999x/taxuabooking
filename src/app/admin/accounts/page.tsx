import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/ActionForm";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { toNumber } from "@/lib/format";
import { createAccount, toggleAccountActive, deleteAccount, resetAccountPassword, setCtvCommission, updateAccount } from "./actions";
import { CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const inp = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";

export default async function AccountsPage() {
  const [users, providers, services] = await Promise.all([
    prisma.adminUser.findMany({
      where: { role: { in: ["CTV", "PROVIDER"] } },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { ctvBookings: true, ownedServices: true, ctvs: true } },
        provider: { select: { name: true } },
        ownedServices: { select: { id: true, title: true }, orderBy: { title: "asc" } },
      },
    }),
    prisma.adminUser.findMany({ where: { role: "PROVIDER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Mọi dịch vụ — để gán/gỡ chủ sở hữu ngay trong form sửa tài khoản.
    prisma.service.findMany({
      orderBy: [{ category: "asc" }, { title: "asc" }],
      select: { id: true, title: true, category: true, ownerId: true, owner: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-ink">Tài khoản CTV / Chủ dịch vụ</h1>
      <p className="mt-1 text-sm text-gray-500">Tạo tài khoản cho cộng tác viên (đặt đơn) và chủ nhà xe / homestay (xem đơn & thanh toán).</p>

      {/* Tạo mới */}
      <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-lg font-semibold text-ink">Tạo tài khoản</h2>
        <ActionForm action={createAccount} className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
          <label className="block sm:col-span-1"><span className="text-xs font-medium text-gray-500">Vai trò</span>
            <select name="role" defaultValue="CTV" className={inp}>
              <option value="CTV">CTV</option>
              <option value="PROVIDER">Chủ dịch vụ</option>
            </select>
          </label>
          <label className="block sm:col-span-1"><span className="text-xs font-medium text-gray-500">Tên đăng nhập</span><input name="username" className={inp} required /></label>
          <label className="block sm:col-span-1"><span className="text-xs font-medium text-gray-500">Mật khẩu</span><input name="password" className={inp} required /></label>
          <label className="block sm:col-span-2"><span className="text-xs font-medium text-gray-500">Họ tên</span><input name="name" className={inp} required /></label>
          <label className="block sm:col-span-1"><span className="text-xs font-medium text-gray-500">SĐT</span><input name="phone" className={inp} /></label>
          <label className="block sm:col-span-2"><span className="text-xs font-medium text-gray-500">Hoa hồng/đơn (CTV, đ)</span><MoneyInput name="commissionPerOrder" placeholder="VD 100.000" className={inp} /></label>
          <label className="block sm:col-span-4"><span className="text-xs font-medium text-gray-500">Thuộc chủ cơ sở (chỉ cho CTV)</span>
            <select name="providerId" defaultValue="" className={inp}>
              <option value="">— Không gắn —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="sm:col-span-6"><button className="rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white">Tạo tài khoản</button></div>
        </ActionForm>
      </section>

      {/* Danh sách */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Tài khoản</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3 hidden sm:table-cell">SĐT</th>
              <th className="px-4 py-3">Hoa hồng (CTV)</th>
              <th className="px-4 py-3">Hoạt động</th>
              <th className="px-4 py-3">Đổi MK</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-500">Chưa có tài khoản nào.</td></tr>
            ) : (
              users.map((u) => (
                <Fragment key={u.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-xs text-gray-400">
                      @{u.username} · {u.role === "CTV"
                        ? `${u._count.ctvBookings} đơn · thuộc ${u.provider?.name ?? "chưa gán"}`
                        : `${u._count.ownedServices} dịch vụ · ${u._count.ctvs} CTV`}
                    </div>
                    {u.role === "PROVIDER" && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.ownedServices.length === 0 ? (
                          <span className="text-xs text-amber-600">Chưa gắn dịch vụ nào — gắn ở trang sửa dịch vụ.</span>
                        ) : (
                          u.ownedServices.map((sv) => (
                            <Link key={sv.id} href={`/admin/services/${sv.id}`} className="rounded bg-forest-50 px-2 py-0.5 text-xs text-forest-700 hover:bg-forest-100">
                              {sv.title}
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.role === "CTV" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{u.role === "CTV" ? "CTV" : "Chủ dịch vụ"}</span></td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.role === "CTV" ? (
                      <form action={setCtvCommission} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={u.id} />
                        <MoneyInput name="commissionPerOrder" defaultValue={toNumber(u.commissionPerOrder) ?? ""} placeholder="0" className="w-24 rounded border border-gray-200 px-2 py-1 text-xs" />
                        <button className="rounded bg-forest-100 px-2 py-1 text-xs font-medium text-forest-700">Lưu</button>
                      </form>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleAccountActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.active ? "bg-forest-100 text-forest-700" : "bg-gray-200 text-gray-500"}`}>{u.active ? "Đang hoạt động" : "Đã khoá"}</button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <ActionForm action={resetAccountPassword} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="password" placeholder="MK mới" className="w-24 rounded border border-gray-200 px-2 py-1 text-xs" />
                      <button className="rounded bg-forest-100 px-2 py-1 text-xs font-medium text-forest-700">Đổi</button>
                    </ActionForm>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteAccount}><input type="hidden" name="id" value={u.id} /><button className="text-xs font-medium text-red-600 hover:underline">Xoá</button></form>
                  </td>
                </tr>
                <tr>
                  <td colSpan={7} className="px-4 pb-3 pt-0">
                    <EditAccount u={u} providers={providers} services={services} />
                  </td>
                </tr>
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Form SỬA TOÀN BỘ một tài khoản (thu gọn trong <details>). */
function EditAccount({
  u,
  providers,
  services,
}: {
  u: {
    id: string;
    username: string;
    name: string;
    phone: string | null;
    role: string;
    active: boolean;
    providerId: string | null;
    commissionPerOrder: unknown;
  };
  providers: { id: string; name: string }[];
  services: { id: string; title: string; category: keyof typeof CATEGORIES; ownerId: string | null; owner: { name: string } | null }[];
}) {
  const lbl = "text-xs font-medium text-gray-500";
  return (
    <details className="group rounded-xl border border-gray-200 bg-gray-50/60">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-forest-700">
        ✎ Sửa thông tin <span className="font-normal text-gray-400 group-open:hidden">— họ tên, đăng nhập, SĐT, vai trò, dịch vụ…</span>
      </summary>
      <ActionForm action={updateAccount} className="grid grid-cols-1 gap-3 border-t border-gray-200 p-3 sm:grid-cols-6 sm:items-end">
        <input type="hidden" name="id" value={u.id} />
        <label className="block sm:col-span-2"><span className={lbl}>Họ tên</span><input name="name" defaultValue={u.name} className={inp} required /></label>
        <label className="block sm:col-span-2"><span className={lbl}>Tên đăng nhập</span><input name="username" defaultValue={u.username} className={inp} required /></label>
        <label className="block sm:col-span-2"><span className={lbl}>SĐT</span><input name="phone" defaultValue={u.phone ?? ""} className={inp} /></label>
        <label className="block sm:col-span-2"><span className={lbl}>Vai trò</span>
          <select name="role" defaultValue={u.role} className={inp}>
            <option value="CTV">CTV</option>
            <option value="PROVIDER">Chủ dịch vụ</option>
          </select>
        </label>
        <label className="block sm:col-span-2"><span className={lbl}>Mật khẩu mới</span><input name="password" placeholder="Để trống = giữ nguyên" autoComplete="new-password" className={inp} /></label>
        <label className="flex items-center gap-2 pb-2 text-sm sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4 accent-forest-600" /> Đang hoạt động
        </label>
        <label className="block sm:col-span-3"><span className={lbl}>Thuộc chủ cơ sở (CTV)</span>
          <select name="providerId" defaultValue={u.providerId ?? ""} className={inp}>
            <option value="">— Không gắn —</option>
            {providers.filter((p) => p.id !== u.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-3"><span className={lbl}>Hoa hồng/đơn (CTV, đ)</span>
          <MoneyInput name="commissionPerOrder" defaultValue={toNumber(u.commissionPerOrder as never) ?? ""} placeholder="0" className={inp} />
        </label>
        <fieldset className="sm:col-span-6">
          <legend className={lbl}>Dịch vụ sở hữu (chủ dịch vụ) — tick để gán, bỏ tick để gỡ</legend>
          <div className="mt-1 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 sm:grid-cols-2">
            {services.map((sv) => (
              <label key={sv.id} className="flex items-start gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50">
                <input type="checkbox" name="serviceIds" value={sv.id} defaultChecked={sv.ownerId === u.id} className="mt-0.5 h-4 w-4 accent-forest-600" />
                <span className="min-w-0">
                  <span className="text-ink">{sv.title}</span>{" "}
                  <span className="text-xs text-gray-400">
                    · {CATEGORIES[sv.category].shortLabel}
                    {sv.ownerId && sv.ownerId !== u.id ? ` · đang thuộc ${sv.owner?.name ?? "người khác"}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">Tick dịch vụ đang thuộc người khác sẽ chuyển sang tài khoản này. CTV không sở hữu dịch vụ (bỏ qua mục này).</p>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-6">
          <span className="text-[11px] text-gray-400">Đổi vai trò / tên đăng nhập có hiệu lực từ lần đăng nhập sau của tài khoản.</span>
          <button className="rounded-xl bg-forest-600 px-5 py-2 text-sm font-semibold text-white">Lưu thay đổi</button>
        </div>
      </ActionForm>
    </details>
  );
}
