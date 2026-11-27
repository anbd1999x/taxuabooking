import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const ids = ["cmwhywbtw00v9unzkm029m4iq", "cmwhywlas014lunzkb7n2hjze", "cmwhywcww00wcunzkk2w9tlrw", "cmwhyw4lz00o0unzk0vdqpbot", "cmwhywas800u6unzk3jyc1jwi", "cmwhywe8500xounzkt94u4ml5"];
(async () => {
  for (const id of ids) {
    const r = await p.translation.findUnique({ where: { id } });
    const v = r!.value.replace(/Tà Xùa(?! Booking)/g, "Ta Xua");
    await p.translation.update({ where: { id }, data: { value: v } });
    console.log(r!.source, "|", r!.value, "→", v);
  }
  const f = "src/lib/i18n/dict/en.json";
  const raw = fs.readFileSync(f, "utf8");
  const d = JSON.parse(raw);
  d["Trung tâm Tà Xùa"] = "Ta Xua centre";
  d["Trung tâm xã Tà Xùa"] = "Ta Xua commune centre";
  fs.writeFileSync(f, JSON.stringify(d, null, 1) + (raw.endsWith("\n") ? "\n" : ""));
  await p.$disconnect();
})();
