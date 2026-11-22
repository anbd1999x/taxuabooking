import { ChatInbox } from "@/components/admin/ChatInbox";

export const dynamic = "force-dynamic";

/** Chat trực tiếp với khách (khung chat desktop trên trang khách). Chỉ ADMIN — proxy chặn vai trò khác. */
export default async function AdminChatPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Chat với khách</h1>
        <p className="mt-1 hidden text-sm text-gray-500 sm:block">
          Khách nhắn từ khung chat trên website (máy tính). Tin mới tự hiện sau vài giây; bật thông báo ở góc trên để nhận tin trên điện thoại.
        </p>
      </header>
      <ChatInbox initialThreadId={t ?? null} />
    </div>
  );
}
