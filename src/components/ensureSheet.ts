/**
 * Gọi làm tươi tình trạng phòng (đồng bộ Google Sheet) cho 1 homestay ngay trước
 * khi đặt. Server tự bỏ qua nếu vừa đồng bộ <60s. Lỗi/chậm KHÔNG chặn việc đặt.
 */
export async function ensureSheetFresh(serviceId: string | null | undefined): Promise<void> {
  if (!serviceId) return;
  try {
    await fetch("/api/sheet-sync/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId }),
    });
  } catch {
    /* bỏ qua lỗi mạng — vẫn cho đặt */
  }
}
