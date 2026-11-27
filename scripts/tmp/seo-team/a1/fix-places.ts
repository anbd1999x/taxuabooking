// Sửa dữ liệu Place lệch so với toạ độ / quãng đường xe chạy thật (RoadDistance). Ghi log trước → sau.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const dry = process.argv.includes("--dry");

type Fix = { id: string; set?: Record<string, string | null>; content?: [string, string][]; desc?: [string, string][] };
const FIXES: Fix[] = [
  {
    id: "checkin_dinh_gio",
    set: { name: "Đỉnh Gió", address: "3,1 km từ trung tâm", tip: "Gần trung tâm, khoảng 7 phút xe máy; tới trước 6h để chọn chỗ đứng." },
    desc: [["Điểm săn mây gần trung tâm nhất: biển mây", "Điểm săn mây gần trung tâm (3,1 km đường xe chạy): biển mây"]],
    content: [["Cách trung tâm khoảng 2 km (chừng 8–10 phút xe máy).", "Cách trung tâm khoảng 3 km đường xe chạy (chừng 7–10 phút xe máy)."]],
  },
  { id: "checkin_cay_co_don", set: { area: "Háng Đồng", address: "16,1 km từ trung tâm" } },
  { id: "checkin_thao_nguyen", set: { address: "13,4 km từ trung tâm" } },
  {
    id: "checkin_mom_ca_heo",
    set: { address: "14,8 km từ trung tâm" },
    content: [["cách Cây cô đơn chưa tới 1 km.", "cách Cây cô đơn khoảng 1,4 km đường xe chạy."]],
  },
  {
    id: "checkin_song_lung",
    set: { address: "13,4 km từ trung tâm" },
    content: [["cách trung tâm khoảng 12–15 km.", "cách trung tâm khoảng 13,4 km đường xe chạy (45–50 phút xe máy)."]],
  },
  { id: "cmwd3r92v00vmod28a8ttu0ii", set: { area: "Háng Đồng" } }, // Lán Cô Đơn: cách Cây cô đơn 0,5 km, không phải Khe Cải
  {
    id: "cmwd505ln00v6p728cpjkwgrr", // Trạm Mâm Xôi
    set: { area: "Xím Vàng", address: "Xã Xím Vàng" },
    content: [["Cách trung tâm Tà Xùa khoảng 15–20 km (khoảng 40 phút xe máy)", "Cách trung tâm Tà Xùa khoảng 20 km đường xe chạy (khoảng 40 phút xe máy)"]],
  },
  {
    id: "cmwd56smu00wlod28c1a1rels", // Amei Hill
    content: [["Cách trung tâm khoảng 1 km theo hướng về Bắc Yên.", "Cách trung tâm khoảng 1,7 km đường xe chạy theo hướng về Bắc Yên."]],
  },
  { id: "cmwrea17y0054qo27ixrxwofl", set: { area: "Bụa A" } }, // Tà Xùa Farm: bản Bụa A, cách Thảo nguyên ~9 km
  { id: "cmwredtn80058qo27xoxx0d8x", set: { area: "Bụa A" } }, // Thôn Bụa A: 6,6 km, không phải Trung tâm
  {
    id: "cmwd3ykal00vqod28u4eivn0o", // Thác Mây (Khèn Coffee): bỏ khoảng trắng thừa trong tên
    set: { name: "Thác Mây Tà Xùa (Khèn Coffee)" },
  },
  { id: "cmvxawasr0013unbc96gb68mm", set: { area: "Đỉnh Gió" } }, // CAFE Khèn Coffee House: homestay cùng toạ độ + mọi nhà quanh 1 km đều "Đỉnh Gió"
];

(async () => {
  for (const f of FIXES) {
    const row = await p.place.findUnique({ where: { id: f.id } });
    if (!row) throw new Error("missing " + f.id);
    const data: Record<string, string | null> = { ...(f.set ?? {}) };
    for (const [k, v] of Object.entries(f.set ?? {})) console.log(`${row.slug} · ${k}: ${JSON.stringify((row as Record<string, unknown>)[k])} → ${JSON.stringify(v)}`);
    for (const [field, reps] of [["content", f.content], ["desc", f.desc]] as const) {
      if (!reps) continue;
      let s = (row as Record<string, unknown>)[field] as string;
      for (const [a, b] of reps) {
        if (!s.includes(a)) throw new Error(`${row.slug}.${field}: không thấy "${a}"`);
        s = s.replace(a, b);
        console.log(`${row.slug} · ${field}: "${a}" → "${b}"`);
      }
      data[field] = s;
    }
    if (!dry) await p.place.update({ where: { id: f.id }, data });
  }
  console.log(dry ? "DRY" : "ĐÃ GHI");
  await p.$disconnect();
})();
