import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SubBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** Đăng ký nhận Web Push thông báo đơn mới (chỉ tài khoản ADMIN). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ tài khoản quản trị bật được thông báo." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as SubBody | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Thiếu dữ liệu đăng ký." }, { status: 400 });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth, userId: session.sub, role: session.role },
    create: {
      endpoint,
      p256dh,
      auth,
      userId: session.sub,
      role: session.role,
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  return NextResponse.json({ ok: true });
}

/** Huỷ đăng ký thông báo của thiết bị này. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Thiếu endpoint." }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } });
  return NextResponse.json({ ok: true });
}
