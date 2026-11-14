import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Giờ Việt Nam (server chạy UTC trong Docker). */
const TIME_FMT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const FULL_FMT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "vừa xong" / "5 phút trước" / "2 giờ trước" / "3 ngày trước". */
function relTime(d: Date, now: number): string {
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86_400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86_400)} ngày trước`;
}

export default async function SheetSyncPage() {
  const services = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] }, sheetUrl: { not: null } },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      sheetUrl: true,
      sheetSyncedAt: true,
      sheetSyncResult: true,
      sheetSyncLogs: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, ok: true, source: true, summary: true, changes: true, createdAt: true },
      },
    },
  });
  const now = Date.now();
  const errorCount = services.filter((s) => s.sheetSyncResult?.startsWith("Lỗi")).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Đồng bộ Google Sheet</h1>
      <p className="mt-1 text-sm text-gray-500">
        Lịch phòng tự đồng bộ từ Google Sheet <strong>mỗi 5 phút</strong> (cron trên server). Nhật ký ghi lại các
        lần chạy tay và các lần cron <strong>có thay đổi</strong> hoặc <strong>lỗi</strong> — cron chạy mà lịch
        không đổi thì chỉ cập nhật &ldquo;lần gần nhất&rdquo;, không thêm dòng. Nhật ký giữ 30 ngày.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
          <strong>{services.length}</strong> homestay có link sheet
        </span>
        <span className={`rounded-xl px-3 py-2 shadow-sm ${errorCount ? "bg-red-50 text-red-700" : "bg-white text-gray-600"}`}>
          {errorCount ? `${errorCount} homestay đang lỗi đồng bộ` : "Không có lỗi đồng bộ"}
        </span>
        <Link href="/admin/availability" className="rounded-xl bg-forest-100 px-3 py-2 font-medium text-forest-700 hover:bg-forest-100/80">
          ⟳ Đồng bộ tay hàng loạt →
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {services.map((s) => {
          const err = s.sheetSyncResult?.startsWith("Lỗi");
          return (
            <div key={s.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${err ? "bg-red-500" : s.sheetSyncedAt ? "bg-emerald-500" : "bg-gray-300"}`} />
                    <h2 className="truncate font-semibold text-ink">{s.title}</h2>
                  </div>
                  <p className={`mt-1 text-sm ${err ? "text-red-600" : "text-gray-600"}`}>
                    {s.sheetSyncResult ?? "Chưa đồng bộ lần nào"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {s.sheetSyncedAt
                      ? `Lần gần nhất: ${relTime(s.sheetSyncedAt, now)} · ${FULL_FMT.format(s.sheetSyncedAt)}`
                      : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <a href={s.sheetUrl!} target="_blank" rel="noreferrer" className="text-forest-700 underline-offset-2 hover:underline">
                    Mở sheet ↗
                  </a>
                  <Link href={`/admin/services/${s.id}`} className="text-gray-500 underline-offset-2 hover:underline">
                    Sửa dịch vụ
                  </Link>
                </div>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer select-none text-xs font-medium text-gray-500 hover:text-ink">
                  Lịch sử ({s.sheetSyncLogs.length}{s.sheetSyncLogs.length === 30 ? "+" : ""})
                </summary>
                {s.sheetSyncLogs.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-400">Chưa có mục nào — cron chưa gặp thay đổi/lỗi và chưa ai chạy tay.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-50 border-t border-gray-100 text-xs">
                    {s.sheetSyncLogs.map((log) => (
                      <li key={log.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
                        <span className="w-32 shrink-0 tabular-nums text-gray-400" title={FULL_FMT.format(log.createdAt)}>
                          {TIME_FMT.format(log.createdAt)}
                        </span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${log.source === "CRON" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>
                          {log.source === "CRON" ? "Tự động" : "Chạy tay"}
                        </span>
                        {log.ok && log.changes > 0 && (
                          <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {log.changes} thay đổi
                          </span>
                        )}
                        <span className={log.ok ? "text-gray-600" : "font-medium text-red-600"}>{log.summary}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
          );
        })}
        {services.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
            Chưa có homestay nào gắn link Google Sheet. Vào trang sửa dịch vụ → mục Google Sheet để dán link.
          </p>
        )}
      </div>
    </div>
  );
}
