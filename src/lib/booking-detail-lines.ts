import { addWeekdays } from "@/lib/date-format";

/** Một dòng gạch đầu dòng trong mục "Chi tiết" của đơn (label có thể rỗng = chỉ hiện nội dung). */
export interface DetailLine {
  label: string;
  value: string;
}

/**
 * Tách phần "Chi tiết" của đơn (selectionLabel + các chip phụ) thành từng dòng dễ đọc.
 * Đơn combo (nhãn dạng "Combo: xe X (đi …, về …) + Homestay · phòng, N đêm (a → b) · khách · xe nằm: … · xe máy…")
 * được bóc thành từng mục có nhãn; các chip phụ trùng thông tin (số đêm, số cabin, ngày nhận phòng) bị bỏ.
 * Nhãn không đúng mẫu ⇒ chỉ tách theo " · " thành các dòng không nhãn.
 */
export function bookingDetailLines(chips: string[]): DetailLine[] {
  // Ngày trong nhãn đơn hiện kèm thứ: "01/01/2027 (Thứ 6)".
  return parseDetailLines(chips).map((l) => ({ label: l.label, value: addWeekdays(l.value) }));
}

function parseDetailLines(chips: string[]): DetailLine[] {
  const plain = (list: string[]): DetailLine[] =>
    list
      .flatMap((c) => c.split(" · "))
      .map((s) => s.trim())
      .filter(Boolean)
      .map((value) => ({ label: "", value }));

  const first = chips[0] ?? "";
  if (!first.startsWith("Combo:")) return plain(chips);

  const parts = first.split(" · ").map((s) => s.trim()).filter(Boolean);
  const head = /^Combo: xe (.+?) \((.+)\) \+ (.+)$/.exec(parts[0] ?? "");
  if (!head) return plain(chips);

  const out: DetailLine[] = [{ label: "Nhà xe", value: head[1] }];
  const trip = /^đi (.+?), về (.+?)(?:, đón tại (.+))?$/.exec(head[2]);
  if (trip) {
    out.push({ label: "Chiều đi", value: trip[1] });
    out.push({ label: "Chiều về", value: trip[2] });
    if (trip[3]) out.push({ label: "Điểm đón", value: trip[3] });
  } else {
    out.push({ label: "Lịch xe", value: head[2] });
  }
  out.push({ label: "Homestay", value: head[3] });

  for (const p of parts.slice(1)) {
    const stay = /^(.*), (\d+ đêm \(.+\))$/.exec(p);
    const berth = /^xe nằm: (.+)$/.exec(p);
    const motoSeparate = /^DỊCH VỤ KÈM.*?: thuê xe máy (.+)$/.exec(p);
    const motoOld = /^thuê xe máy: (.+)$/.exec(p);
    const custom = /^COMBO TỰ CHỌN: (.+)$/.exec(p);
    if (stay) {
      // "2× Phòng đôi (P201, P202) + 1× Gia đình (F1), +1 khách ở ghép (phụ thu …)" ⇒ mỗi hạng 1 dòng.
      const ghep = /^(.*?), (\+\d+ khách ở ghép .+)$/.exec(stay[1]);
      const roomsText = ghep ? ghep[1] : stay[1];
      const groups = roomsText.split(/ \+ (?=\d+× )/).map((s) => s.trim()).filter(Boolean);
      if (groups.length > 1) groups.forEach((g, i) => out.push({ label: i === 0 ? `Phòng (${groups.length} hạng)` : "", value: g }));
      else out.push({ label: "Phòng", value: roomsText });
      if (ghep) out.push({ label: "Ở ghép", value: ghep[2] });
      // "1 đêm (01/01/2027 → 02/01/2027)" ⇒ "01/01/2027 → 02/01/2027 · 1 đêm" (khỏi lồng ngoặc khi chèn thứ).
      const sm = /^(\d+ đêm) \((.+)\)$/.exec(stay[2]);
      out.push({ label: "Lưu trú", value: sm ? `${sm[2]} · ${sm[1]}` : stay[2] });
    } else if (custom) out.push({ label: "Combo tự chọn", value: custom[1] });
    else if (berth) out.push({ label: "Chỗ nằm trên xe", value: berth[1] });
    else if (motoSeparate) out.push({ label: "Xe máy (tính riêng, ngoài bill)", value: motoSeparate[1] });
    else if (motoOld) out.push({ label: "Thuê xe máy", value: motoOld[1] });
    else if (/người lớn|trẻ|khách/.test(p)) out.push({ label: "Khách", value: p });
    else out.push({ label: "", value: p });
  }
  return out;
}
