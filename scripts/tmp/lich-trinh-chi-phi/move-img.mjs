import fs from "node:fs";
const d = "scripts/tmp/lich-trinh-chi-phi/";
for (const l of ["vi", "en", "zh", "ko"]) {
  const L = fs.readFileSync(d + l + ".md", "utf8").replace(/\r\n/g, "\n").split("\n");
  const i = L.findIndex((x) => x.startsWith("![") && x.includes("1794459847621"));
  if (i < 0 || i > 8) throw new Error(l + ": không thấy ảnh đầu bài");
  const [img] = L.splice(i, 2); // ảnh + dòng trống sau
  let n = 0;
  const j = L.findIndex((x) => x.startsWith("### ") && ++n === 3);
  L.splice(j, 0, img, "");
  fs.writeFileSync(d + l + ".md", L.join("\n"));
  console.log(l, "ảnh dời từ dòng", i + 1, "xuống trước:", L[j + 2].slice(0, 50));
}
