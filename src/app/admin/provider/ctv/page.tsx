import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/ActionForm";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { toNumber } from "@/lib/format";
import { createMyCtv, toggleMyCtv, deleteMyCtv, setMyCtvCommission } from "../actions";

export const dynamic = "force-dynamic";

const inp = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";

export default async function MyCtvPage() {
  const session = await getSession();
  const ctvs = await prisma.adminUser.findMany({
    where: { role: "CTV", providerId: session!.sub },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { ctvBookings: true } } },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">CTV của tôi</h1>
      <p className="mt-1 text-sm text-gray-500">Tạo tài khoản cộng tác viên cho cơ sở của bạn. Đơn do CTV đặt sẽ ghi nhận cho họ.</p>

      <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-lg font-semibold text-ink">Tạo CTV</h2>
        <ActionForm action={createMyCtv} className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
          <label className="block sm:col-span-2"><span className="text-xs font-medium text-gray-500">Tên đăng nhập</span><input name="username" className={inp} required /></label>
          <label className="block sm:col-span-1"><span className="text-xs font-medium text-gray-500">Mật khẩu</span><input name="password" className={inp} required /></label>
          <label className="block sm:col-span-2"><span className="text-xs font-medium text-gray-500">Họ tên</span><input name="name" className={inp} required /></label>
          <label className="block sm:col-span-1"><span className="text-xs font-medium text-gray-500">SĐT</span><input name="phone" className={inp} /></label>
          <label className="block sm:col-span-2"><span className="text-xs font-medium text-gray-500">Hoa hồng/đơn (đ)</span><MoneyInput name="commissionPerOrder" placeholder="VD 100.000" className={inp} /></label>
          <div className="sm:col-span-6"><button className="rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white">Tạo CTV</button></div>
        </ActionForm>
      </section>

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">CTV</th>
              <th className="px-4 py-3 hidden sm:table-cell">SĐT</th>
              <th className="px-4 py-3 text-center">Đơn</th>
              <th className="px-4 py-3">Hoa hồng/đơn</th>
              <th className="px-4 py-3">Hoạt động</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ctvs.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">Chưa có CTV nào.</td></tr>
            ) : (
              ctvs.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><div className="font-medium text-ink">{u.name}</div><div className="text-xs text-gray-400">@{u.username}</div></td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{u._count.ctvBookings}</td>
                  <td className="px-4 py-3">
                    <form action={setMyCtvCommission} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <MoneyInput name="commissionPerOrder" defaultValue={toNumber(u.commissionPerOrder) ?? ""} placeholder="0" className="w-24 rounded border border-gray-200 px-2 py-1 text-xs" />
                      <button className="rounded bg-forest-100 px-2 py-1 text-xs font-medium text-forest-700">Lưu</button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleMyCtv}><input type="hidden" name="id" value={u.id} />
                      <button className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.active ? "bg-forest-100 text-forest-700" : "bg-gray-200 text-gray-500"}`}>{u.active ? "Đang hoạt động" : "Đã khoá"}</button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteMyCtv}><input type="hidden" name="id" value={u.id} /><button className="text-xs font-medium text-red-600 hover:underline">Xoá</button></form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
