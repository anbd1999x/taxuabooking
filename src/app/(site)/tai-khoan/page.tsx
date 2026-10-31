import type { Metadata } from "next";
import Link from "next/link";
import { getCustomer } from "@/lib/customer";
import { CustomerAuthForms } from "@/components/CustomerAuthForms";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tài khoản",
  robots: { index: false },
};

function str(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = str(sp.next) || "/";
  const customer = await getCustomer();

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-md">
        <header className="mb-5 text-center">
          <h1 className="text-2xl font-bold text-ink">{customer ? "Tài khoản" : "Đăng nhập / Đăng ký"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {customer ? "Bạn đã đăng nhập." : "Đăng nhập để đánh giá dịch vụ bạn đã trải nghiệm."}
          </p>
        </header>

        {customer ? (
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest-100 text-xl font-bold text-forest-700">
              {customer.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="mt-3 text-lg font-bold text-ink">{customer.name}</div>
            <div className="text-sm text-gray-500">{customer.phone}</div>
            <div className="mt-4 flex flex-col gap-2">
              <Link href={next !== "/" ? next : "/"} className="rounded-xl bg-forest-600 py-2.5 text-sm font-bold text-white hover:bg-forest-700">
                {next !== "/" ? "Quay lại trang trước" : "Về trang chủ"}
              </Link>
              <form action={logoutAction}>
                <button className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Đăng xuất
                </button>
              </form>
            </div>
          </div>
        ) : (
          <CustomerAuthForms next={next} />
        )}
      </div>
    </div>
  );
}
