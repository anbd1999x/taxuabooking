/**
 * Tính vector CLIP cho ảnh homestay (tìm kiếm theo ảnh) — chạy tay khi cần nạp lần đầu / bù nhanh.
 * Cần embedder đang chạy (cd embedder && npm start, hoặc container embedder; EMBEDDER_URL để trỏ nơi khác).
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/index-image-embeddings.ts [số ảnh mỗi lượt]
 * Tự lặp tới khi hết ảnh thiếu. Ảnh /uploads không có trên máy ⇒ tải bản thu nhỏ từ website (NEXT_PUBLIC_SITE_URL).
 */
import { indexImageEmbeddings } from "../src/lib/image-search";
import { prisma } from "../src/lib/prisma";

const per = Number(process.argv[2]) || 200;
(async () => {
  const t0 = Date.now();
  for (;;) {
    const r = await indexImageEmbeddings({ limit: per, log: (m) => console.log(m) });
    if (r.skipped) { console.log("Bỏ qua:", r.skipped); break; }
    if (r.left === 0 || r.done + r.failed === 0) break;
  }
  const n = await prisma.imageEmbedding.count();
  const bad = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) n from "ImageEmbedding" where length(vec) = 0`;
  console.log(`Xong sau ${Math.round((Date.now() - t0) / 1000)}s — ${n} ảnh có trong bảng, ${bad[0].n} ảnh lỗi.`);
  await prisma.$disconnect();
})();
