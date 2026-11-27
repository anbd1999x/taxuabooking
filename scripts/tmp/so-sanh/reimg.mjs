// Thay / chèn ảnh địa danh trong 4 bản ngôn ngữ (cùng số dòng) + dòng ghi nguồn ảnh
import fs from "node:fs";
const D = "scripts/tmp/so-sanh"; const U = JSON.parse(fs.readFileSync(`${D}/uploaded.json`, "utf8"));
const L = ["vi", "en", "zh", "ko"];
const TX_CLOUD = "/uploads/1793855540301-d3c403997f37.jpg", TX_SONGLUNG = "/uploads/1794459847911-f44cfb075b23.jpg";
const A = {
  nhoque: ["Hẻm sông Nho Quế màu xanh ngọc uốn giữa vách núi đá ở Hà Giang, nhìn từ đèo Mã Pì Lèng", "The jade-green Nho Quế river winding through a limestone canyon in Hà Giang, seen from Mã Pì Lèng pass", "河江省马丕冷山口俯瞰的翠绿色侬桂河峡谷", "마피렝 고개에서 내려다본 하장의 옥빛 뇨꿰 강 협곡"],
  road: ["Con đường nhỏ uốn quanh sườn núi đá trên đèo Mã Pì Lèng, Hà Giang", "A narrow road winding along the rocky mountainside at Mã Pì Lèng pass, Hà Giang", "河江马丕冷山口沿石山蜿蜒的小路", "하장 마피렝 고개의 바위산 허리를 따라 굽이치는 좁은 길"],
  bangioc: ["Thác Bản Giốc nhiều tầng đổ xuống hồ nước xanh giữa rừng, Cao Bằng", "The multi-tiered Bản Giốc waterfall pouring into a green pool amid forest, Cao Bằng", "高平省板约瀑布多层飞泻，落入林间碧潭", "숲 사이 푸른 물웅덩이로 쏟아지는 여러 단의 반지옥 폭포, 까오방"],
  bangioc2: ["Toàn cảnh thác Bản Giốc và núi đá vôi trong sương sớm, Cao Bằng", "Bản Giốc waterfall and limestone peaks in the morning mist, Cao Bằng", "晨雾中的板约瀑布与石灰岩山峰全景，高平", "아침 안개 속 반지옥 폭포와 석회암 봉우리 전경, 까오방"],
  nguomout: ["Cánh đồng lúa xanh và núi đá vôi gần động Ngườm Ngao, huyện Trùng Khánh cũ, Cao Bằng", "Green rice fields and limestone hills near Ngườm Ngao cave, former Trùng Khánh district, Cao Bằng", "高平省原重庆县岩鳌洞附近的绿色稻田与石灰岩山", "까오방 옛 쭝카인 현 응엄응아오 동굴 근처의 푸른 논과 석회암 산"],
  nguom: ["Lối đi có đèn bên trong động Ngườm Ngao, gần thác Bản Giốc, Cao Bằng", "A lit walkway inside Ngườm Ngao cave near Bản Giốc waterfall, Cao Bằng", "高平板约瀑布附近岩鳌洞内亮着灯的步道", "까오방 반지옥 폭포 근처 응엄응아오 동굴 안의 조명 산책로"],
  checunha: ["Ruộng bậc thang uốn lượn ở xã Chế Cu Nha, Mù Cang Chải, mùa lúa chín", "Curving rice terraces in Chế Cu Nha commune, Mù Cang Chải, in the ripening season", "稻熟季节木江界车枯娜乡蜿蜒的梯田", "벼가 익는 계절 무깡짜이 쩨꾸냐 마을의 굽이진 계단식 논"],
  khaupha: ["Ruộng bậc thang xanh dưới chân đèo Khau Phạ, Mù Cang Chải", "Green rice terraces below Khau Phạ pass, Mù Cang Chải", "木江界考帕山口下的绿色梯田", "무깡짜이 카우파 고개 아래의 초록 계단식 논"],
  limmong: ["Dù lượn bay trên ruộng bậc thang lúa chín ở thung lũng Lìm Mông, Mù Cang Chải", "A paraglider over golden rice terraces in Lìm Mông valley, Mù Cang Chải", "木江界林蒙山谷金色梯田上空的滑翔伞", "무깡짜이 림몽 계곡 황금빛 계단식 논 위를 나는 패러글라이더"],
  txcloud: ["Biển mây trắng cuộn dưới thung lũng nhìn từ Tà Xùa", "A white sea of clouds rolling below the valley, seen from Tà Xùa", "从塔萨俯瞰山谷下翻滚的白色云海", "따쑤아에서 내려다본 계곡 아래로 굽이치는 하얀 운해"],
  txsong: ["Toàn cảnh Sống lưng khủng long Tà Xùa: lối mòn đất chạy dọc sống núi xanh, xa xa là ruộng bậc thang và mây", "Panorama of the Dinosaur Spine in Tà Xùa: a dirt trail along a green ridge, with terraces and clouds in the distance", "塔萨恐龙脊全景：土路沿着青翠山脊延伸，远处是梯田和云", "따쑤아 공룡 등뼈 전경: 초록 능선을 따라 난 흙길, 멀리 계단식 논과 구름"],
  fansipan: ["Đỉnh Fansipan 3.143m và quần thể chùa trên biển mây, Sa Pa, Lào Cai", "Fansipan summit (3,143m) and its temple complex above a sea of clouds, Sa Pa, Lào Cai", "老街沙坝番西邦峰（3,143米）与云海上的寺庙群", "라오까이 사파의 판시판 정상(3,143m)과 운해 위의 사원 단지"],
  tea: ["Đồi chè Mộc Châu với cây khô đơn độc trên đỉnh đồi lúc chiều, Sơn La", "Mộc Châu tea hills with a lone bare tree on the hilltop at dusk, Sơn La", "山罗木州茶山，黄昏时山顶一棵孤零零的枯树", "해 질 녘 언덕 위에 홀로 선 마른 나무와 목쩌우 차 언덕, 선라"],
  puluong: ["Bè tre trên sông giữa thung lũng Pù Luông, Thanh Hóa", "A bamboo raft on the river in the Pù Luông valley, Thanh Hóa", "清化普隆山谷河上的竹筏", "탄호아 푸루옹 계곡 강 위의 대나무 뗏목"],
};
const img = (k, url, l) => `![${A[k][L.indexOf(l)]}](${url})`;
const CR = {
  vi: (s) => `*Ảnh địa danh từ Wikimedia Commons: ${s}. Ảnh Tà Xùa: Tà Xùa Booking.*`,
  en: (s) => `*Landmark photos from Wikimedia Commons: ${s}. Tà Xùa photos: Tà Xùa Booking.*`,
  zh: (s) => `*景点照片来自 Wikimedia Commons：${s}。塔萨照片：Tà Xùa Booking。*`,
  ko: (s) => `*명소 사진 출처 Wikimedia Commons: ${s}. 따쑤아 사진: Tà Xùa Booking.*`,
};
const C = { nhoque: "sông Nho Quế (NKSTTSSHNVN, CC BY-SA 4.0)", road: "đèo Mã Pì Lèng (Khánh Hmoong, CC BY 2.0)", bangioc: "thác Bản Giốc (jankgo, CC BY 2.0)", bangioc2: "thác Bản Giốc (kenner116, CC BY 2.0)", nguom: "Ngườm Ngao (Adam Jones, CC BY-SA 2.0)", checunha: "Chế Cu Nha (Doan Tuan, CC0)", khaupha: "Khau Phạ (Doan Tuan, CC0)", limmong: "Lìm Mông (Mebayluon Paragliding, CC BY-SA 4.0)", fansipan: "Fansipan (Vivu Vietnam, CC BY-SA 4.0)", tea: "Mộc Châu (ToanNguyen, CC0)", puluong: "Pù Luông (Milomaskirovka, CC0)" };
const PLAN = {
  "ha-giang-hay-ta-xua": { cover: U["hg-nhoque"], rep: { 12: ["nhoque", U["hg-nhoque"]], 55: ["road", U["hg-road"]] }, ins: {}, cr: ["nhoque", "road"] },
  "cao-bang-hay-ta-xua": { cover: U["cb-bangioc"], rep: { 11: ["bangioc", U["cb-bangioc"]], 54: ["nguomout", U["cb-nguomngao-out"]] }, ins: { 73: ["nguom", U["cb-nguomngao"]] }, cr: ["bangioc", "nguom"] },
  "mu-cang-chai-hay-ta-xua": { cover: U["mcc-checunha"], rep: { 12: ["checunha", U["mcc-checunha"]], 53: ["limmong", U["mcc-limmong"]], 74: ["khaupha", U["mcc-khaupha"]], 124: ["txcloud", TX_CLOUD] }, ins: {}, cr: ["checunha", "limmong", "khaupha"] },
  "tay-bac-nen-di-dau-so-sanh-ta-xua": { cover: null, rep: { 39: ["tea", U["mc-tea"]], 65: ["checunha", U["mcc-checunha"]] }, ins: { 80: ["fansipan", U["sp-fansipan"]], 84: ["road", U["hg-road"]], 88: ["bangioc", U["cb-bangioc"]], 100: ["puluong", U["pl-puluong"]] }, cr: ["tea", "checunha", "fansipan", "road", "bangioc", "puluong"] },
};
for (const [slug, p] of Object.entries(PLAN)) {
  for (const l of L) {
    const f = `${D}/${slug}${l === "vi" ? "" : "." + l}.md`;
    const ls = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n").trim().split("\n");
    if (ls.some((x) => x.includes("Wikimedia"))) throw new Error("đã sửa rồi: " + f);
    for (const [n, [k, u]] of Object.entries(p.rep)) { if (!ls[n - 1].startsWith("![")) throw new Error(`${f}:${n} không phải ảnh`); ls[n - 1] = img(k, u, l); }
    for (const n of Object.keys(p.ins).map(Number).sort((a, b) => b - a)) { if (ls[n - 1].trim() !== "") throw new Error(`${f}:${n} không trống`); const [k, u] = p.ins[n]; ls.splice(n, 0, img(k, u, l), ""); }
    ls.push("", CR[l](p.cr.map((k) => C[k]).join("; ")));
    fs.writeFileSync(f, ls.join("\n") + "\n");
  }
  if (p.cover) { const mf = `${D}/${slug}.meta.json`; const m = JSON.parse(fs.readFileSync(mf, "utf8")); m.coverImage = p.cover; fs.writeFileSync(mf, JSON.stringify(m, null, 2) + "\n"); }
  console.log("xong", slug);
}
