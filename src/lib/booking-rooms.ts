/**
 * Gom các phòng của một đơn theo HẠNG PHÒNG để hiển thị gọn (admin, tra cứu, email, tin nhắn):
 * "2× Phòng đôi — P201, P202". File thuần (dùng được ở client).
 */
export interface RoomGroup {
  typeName: string;
  /** Tên từng phòng cụ thể trong hạng, theo thứ tự đơn. */
  names: string[];
}

export function roomGroups(rooms: { name: string; roomType: { name: string } }[]): RoomGroup[] {
  const m = new Map<string, RoomGroup>();
  for (const r of rooms) {
    const g = m.get(r.roomType.name);
    if (g) g.names.push(r.name);
    else m.set(r.roomType.name, { typeName: r.roomType.name, names: [r.name] });
  }
  return [...m.values()];
}

/** Mỗi hạng một dòng: "2× Phòng đôi — P201, P202". */
export function roomGroupLines(groups: RoomGroup[]): string[] {
  return groups.map((g) => `${g.names.length}× ${g.typeName} — ${g.names.join(", ")}`);
}

/** Một dòng ngắn: "2× Phòng đôi + 1× Phòng gia đình". */
export function roomGroupsShort(groups: RoomGroup[]): string {
  return groups.map((g) => `${g.names.length}× ${g.typeName}`).join(" + ");
}

/** Một dòng đầy đủ (tin nhắn Zalo): "2× Phòng đôi (P201, P202) + 1× Phòng gia đình (F1)". */
export function roomGroupsFull(groups: RoomGroup[]): string {
  return groups.map((g) => `${g.names.length}× ${g.typeName} (${g.names.join(", ")})`).join(" + ");
}

/** Khách ở ghép ghi trong nhãn đơn combo: "+1 khách ở ghép (phụ thu 150.000đ)" ⇒ "+1 khách ở ghép · phụ thu 150.000đ". */
export function extraGuestNote(selectionLabel: string | null | undefined): string | null {
  const m = /\+(\d+) khách ở ghép \(phụ thu ([\d.]+đ)\)/.exec(selectionLabel ?? "");
  return m ? `+${m[1]} khách ở ghép · phụ thu ${m[2]}` : null;
}
