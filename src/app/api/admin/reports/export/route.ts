import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidDateKey } from "@/lib/dates";
import { CATEGORIES } from "@/lib/constants";
import { computeStats, type ServicePayRow, type StatsDateBy } from "@/lib/stats";
import { buildServicePayWorkbook } from "@/lib/stats-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Bỏ dấu, chỉ giữ chữ-số cho tên tệp. */
function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

/**
 * GET /api/admin/reports/export?service=<id trong bảng thanh toán>&from=&to=&by=use|created
 * ⇒ tệp Excel báo cáo đối soát thanh toán của MỘT dịch vụ (chỉ ADMIN). Số liệu lấy từ
 * `computeStats` — khớp đúng bảng "Thanh toán cho từng dịch vụ" trên trang Thống kê.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Chỉ admin xuất báo cáo." }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const serviceKey = sp.get("service") ?? "";
  let fromKey = sp.get("from") ?? "";
  let toKey = sp.get("to") ?? "";
  if (!serviceKey || !isValidDateKey(fromKey) || !isValidDateKey(toKey)) {
    return NextResponse.json({ error: "Thiếu dịch vụ hoặc khoảng ngày không hợp lệ." }, { status: 400 });
  }
  if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];
  const by: StatsDateBy = sp.get("by") === "created" ? "created" : "use";

  const stats = await computeStats(fromKey, toKey, null, by);
  let row: ServicePayRow | undefined = stats.byService.find((r) => r.id === serviceKey);
  if (!row) {
    // Dịch vụ không có đơn trong kỳ ⇒ vẫn xuất báo cáo trống (có tiêu đề, thông tin đối tác).
    const svc = await prisma.service.findUnique({
      where: { id: serviceKey },
      select: { id: true, title: true, category: true, owner: { select: { name: true } } },
    });
    if (!svc) return NextResponse.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });
    row = {
      id: svc.id,
      name: svc.title,
      kind: svc.category === "CABIN" ? "Nhà xe" : CATEGORIES[svc.category].shortLabel,
      owner: svc.owner?.name ?? null,
      orders: 0, total: 0, discount: 0, payable: 0, paid: 0, remaining: 0, lines: [],
    };
  }

  const buf = await buildServicePayWorkbook({ row, fromKey, toKey, by });
  const file = `doi-soat_${slug(row.name) || "dich-vu"}_${fromKey}_${toKey}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "no-store",
    },
  });
}
