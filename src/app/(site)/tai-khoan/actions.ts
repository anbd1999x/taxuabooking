"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { registerCustomer, loginCustomer, logoutCustomer, updateCustomerPhone } from "@/lib/customer";

export interface AuthState {
  error?: string;
}

export interface PhoneState {
  ok?: boolean;
  error?: string;
}

export async function updatePhoneAction(_prev: PhoneState, fd: FormData): Promise<PhoneState> {
  const r = await updateCustomerPhone(String(fd.get("phone") ?? ""));
  if (r.error) return { error: r.error };
  revalidatePath("/tai-khoan");
  return { ok: true };
}

function sanitizeNext(n: string): string {
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function loginAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const r = await loginCustomer(String(fd.get("phone") ?? ""), String(fd.get("password") ?? ""));
  if (r.error) return { error: r.error };
  redirect(sanitizeNext(String(fd.get("next") ?? "/")));
}

export async function registerAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const r = await registerCustomer(
    String(fd.get("name") ?? ""),
    String(fd.get("phone") ?? ""),
    String(fd.get("password") ?? ""),
  );
  if (r.error) return { error: r.error };
  redirect(sanitizeNext(String(fd.get("next") ?? "/")));
}

export async function logoutAction(): Promise<void> {
  await logoutCustomer();
  redirect("/");
}
