/**
 * Bố cục bản đồ check-in hoạt hình (/ban-do): toạ độ TƯƠNG ĐỐI trên mặt phẳng 100×100 và mạng
 * đường nối các nút. Không phải toạ độ GPS — vị trí chính xác xem ở tab "Vệ tinh Google".
 * Nội dung từng điểm (tên, mô tả, ảnh, khoảng cách) lấy từ bảng Place (kind CHECKIN) theo slug.
 */

export type NodeKey = "tt" | "by" | "dg" | "cd" | "dr" | "sl" | "dc" | "mv" | "bb" | "ld" | "tn" | "mch";

export const MAP_NODES: Record<NodeKey, [number, number]> = {
  tt: [56, 47], // trung tâm Tà Xùa (mốc 0)
  by: [54, 95], // thị trấn Bắc Yên (bến xe cabin)
  dg: [50, 41], // Đỉnh Gió
  cd: [46, 36], // Cây cô đơn
  dr: [35, 26], // Mỏm đầu rùa
  sl: [12, 18], // Sống lưng khủng long
  dc: [60, 68], // Đồi chè Shan tuyết (trên đường Bắc Yên lên)
  mv: [62, 60], // Bản Mống Vàng
  bb: [76, 35], // Rừng chè cổ thụ Bản Bẹ
  ld: [87, 25], // Mỏm lạc đà
  tn: [30, 58], // Thảo nguyên Tà Xùa
  mch: [20, 67], // Mỏm cá heo
};

/** slug của Place (điểm check-in) → nút trên bản đồ. Slug chưa khai ở đây ⇒ chỉ hiện ở danh sách/vệ tinh. */
export const SLUG_NODE: Record<string, NodeKey> = {
  "dinh-gio": "dg",
  "cay-co-don": "cd",
  "mom-dau-rua": "dr",
  "song-lung-khung-long": "sl",
  "doi-che-shan-tuyet": "dc",
  "ban-mong-vai": "mv",
  "ban-mong-vang": "mv",
  "doi-che-co-thu-ban-be": "bb",
  "rung-che-co-thu-ban-be": "bb",
  "mom-lac-da": "ld",
  "thao-nguyen-ta-xua": "tn",
  "mom-ca-heo": "mch",
};

/** Mạng đường: [nút đầu, nút cuối, các điểm của đoạn đường]. `rough` = đường mòn (vẽ nét đứt). */
export const MAP_EDGES: { a: NodeKey; b: NodeKey; pts: [number, number][]; rough?: boolean }[] = [
  { a: "by", b: "dc", pts: [[54, 95], [46, 88], [60, 82], [50, 74], [60, 68]] },
  { a: "dc", b: "mv", pts: [[60, 68], [62, 60]] },
  { a: "mv", b: "tt", pts: [[62, 60], [58, 54], [56, 47]] },
  { a: "tt", b: "dg", pts: [[56, 47], [52, 44], [50, 41]] },
  { a: "dg", b: "cd", pts: [[50, 41], [48, 38], [46, 36]] },
  { a: "cd", b: "dr", pts: [[46, 36], [40, 33], [35, 26]], rough: true },
  { a: "dr", b: "sl", pts: [[35, 26], [28, 28], [22, 22], [12, 18]], rough: true },
  { a: "tt", b: "tn", pts: [[56, 47], [46, 52], [38, 50], [30, 58]] },
  { a: "tn", b: "mch", pts: [[30, 58], [26, 62], [20, 67]] },
  { a: "tt", b: "bb", pts: [[56, 47], [64, 44], [70, 38], [76, 35]] },
  { a: "bb", b: "ld", pts: [[76, 35], [80, 31], [87, 25]] },
];

/** Đường đi ngắn nhất (theo số đoạn) giữa 2 nút, trả về chuỗi điểm. */
export function mapPath(a: NodeKey, b: NodeKey): [number, number][] {
  if (a === b) return [];
  const adj = new Map<NodeKey, [NodeKey, [number, number][]][]>();
  for (const e of MAP_EDGES) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), [e.b, e.pts]]);
    adj.set(e.b, [...(adj.get(e.b) ?? []), [e.a, [...e.pts].reverse()]]);
  }
  const prev = new Map<NodeKey, [NodeKey, [number, number][]] | null>([[a, null]]);
  const q: NodeKey[] = [a];
  while (q.length) {
    const u = q.shift()!;
    if (u === b) break;
    for (const [v, pts] of adj.get(u) ?? []) {
      if (!prev.has(v)) { prev.set(v, [u, pts]); q.push(v); }
    }
  }
  const segs: [number, number][][] = [];
  let cur = b;
  for (let p = prev.get(cur); p; p = prev.get(cur)) { segs.unshift(p[1]); cur = p[0]; }
  return segs.reduce<[number, number][]>((acc, seg, i) => acc.concat(i ? seg.slice(1) : seg), []);
}

/** Chuỗi điểm đi lần lượt qua các nút (một ngày của lịch trình). */
export function mapRoute(nodes: NodeKey[]): [number, number][] {
  let pts: [number, number][] = [];
  for (let i = 1; i < nodes.length; i++) {
    const seg = mapPath(nodes[i - 1], nodes[i]);
    pts = pts.concat(pts.length ? seg.slice(1) : seg);
  }
  return pts;
}
