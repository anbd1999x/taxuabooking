"use server";

import { redirect } from "next/navigation";
import { registerCustomer, loginCustomer, logoutCustomer } from "@/lib/customer";

export interface AuthState {
  error?: string;
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
