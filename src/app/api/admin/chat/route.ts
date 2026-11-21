import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminDelete, adminMessages, adminRead, adminReply, adminSetStatus, adminThreads, cleanBody } from "@/lib/chat";

export const dynamic = "force-dynamic";

/**
 * Chat trực tiếp với khách — phía ADMIN (/admin/chat). Chỉ ADMIN.
 *   GET  ?filter=open|closed|all&thread=<id>&after=<ISO>  → { threads, messages? }
 *   POST { op: "reply", threadId, body } | { op: "read" | "close" | "reopen" | "delete", threadId }
 */

async function requireAdminApi() {
  const s = await getSession();
  return s && s.role === "ADMIN" ? s : null;
}

export async function GET(request: Request) {
  if (!(await requireAdminApi())) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const f = sp.get("filter");
  const filter = f === "closed" || f === "all" ? f : "open";
  const thread = sp.get("thread");
  const [threads, messages] = await Promise.all([adminThreads(filter), thread ? adminMessages(thread, sp.get("after")) : Promise.resolve(undefined)]);
  return NextResponse.json({ threads, messages }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const s = await requireAdminApi();
  if (!s) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  let data: Record<string, unknown>;
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const threadId = typeof data.threadId === "string" ? data.threadId : "";
  if (!threadId) return NextResponse.json({ error: "Thiếu cuộc trò chuyện." }, { status: 400 });
  switch (data.op) {
    case "reply": {
      const body = cleanBody(data.body);
      if (!body) return NextResponse.json({ error: "Tin nhắn trống." }, { status: 400 });
      const message = await adminReply(threadId, body, s.name ?? null);
      if (!message) return NextResponse.json({ error: "Cuộc trò chuyện không còn." }, { status: 404 });
      return NextResponse.json({ ok: true, message });
    }
    case "read":
      await adminRead(threadId);
      return NextResponse.json({ ok: true });
    case "close":
    case "reopen":
      await adminSetStatus(threadId, data.op === "close" ? "closed" : "open");
      return NextResponse.json({ ok: true });
    case "delete":
      await adminDelete(threadId);
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  }
}
