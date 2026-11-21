/**
 * Embedder — dịch vụ HTTP nội bộ: nhận 1 ảnh (bytes), trả vector CLIP 512 chiều đã chuẩn hoá (|v| = 1).
 * App Next gọi khi khách tìm homestay theo ảnh và khi tác vụ nền tính vector cho ảnh đã đăng.
 *
 *   POST /embed   body = bytes ảnh (jpeg/png/webp, nên thu nhỏ ≤ 512px trước)
 *                 → {"vec":[...512], "model":"...", "relevant":0..1, "kind":"room|scenery|food|vehicle|person|screen|other"}
 *   GET  /health  → {"ok":true,"model":"...","ready":true}
 *
 * Mô hình: Xenova/clip-vit-base-patch32 (bản nén 8-bit: nhánh ảnh ~88MB + nhánh chữ ~60MB) — nạp 1 lần lúc
 * khởi động và giữ thường trực. Xử lý tuần tự từng ảnh (onnxruntime tự dùng nhiều luồng CPU cho mỗi ảnh).
 *
 * PHÂN LOẠI ẢNH (zero-shot): so vector ảnh với các câu mô tả dựng sẵn — nhóm "lưu trú / phong cảnh" (GOOD) và
 * nhóm "không liên quan" (BAD: đồ ăn, xe, chân dung, ảnh chụp màn hình…). `relevant` = xác suất thuộc nhóm GOOD
 * (softmax với thang 100 của CLIP). App dùng để từ chối ảnh không liên quan thay vì vẫn xếp kết quả.
 * Đã đo trên ảnh thật: ảnh phòng / cảnh của các home ≥ 0,75; xe, món ăn, màu trơn, chữ ≤ 0,3.
 *
 * Chạy local: cd embedder && npm install && npm start   (cổng 8790; app đọc EMBEDDER_URL, mặc định http://127.0.0.1:8790)
 * Tải sẵn mô hình (lúc build Docker): node server.mjs --download
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, AutoProcessor, AutoTokenizer, CLIPVisionModelWithProjection, CLIPTextModelWithProjection, RawImage } from "@huggingface/transformers";

const MODEL = "Xenova/clip-vit-base-patch32";
const DTYPE = "q8";
const MODEL_TAG = `${MODEL}:${DTYPE}`; // lưu kèm mỗi vector — đổi mô hình ⇒ app tính lại
const PORT = Number(process.env.PORT || 8790);
const MAX_BYTES = 8 * 1024 * 1024;

env.cacheDir = process.env.MODEL_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "models");
env.allowLocalModels = false;

/** Câu mô tả nhóm ẢNH LIÊN QUAN (phòng, nhà, cảnh núi mây, check-in…). */
const GOOD = [
  ["room", "a photo of a bedroom"], ["room", "a hotel room with a bed"], ["room", "a photo of a bathroom"],
  ["room", "a bathtub next to a window"], ["room", "a cozy living room"], ["room", "a balcony with a view"],
  ["room", "the door of a hotel room"], ["room", "a dining area of a homestay"],
  ["house", "a wooden house in the mountains"], ["house", "a homestay building"], ["house", "a bungalow in nature"],
  ["house", "a glass cabin in nature"], ["house", "the exterior of a guesthouse with many windows"],
  ["house", "motorbikes parked in front of a hotel"], ["house", "a swimming pool at a resort"],
  ["house", "a camping tent at a campsite"], ["house", "a garden at a guesthouse"], ["house", "a cafe terrace with a view"],
  ["scenery", "a sea of clouds over mountains"], ["scenery", "a mountain landscape view"], ["scenery", "green hills and valleys"],
  ["scenery", "sunset over mountains"], ["scenery", "people posing at a mountain viewpoint"],
  ["scenery", "a starry night sky over the mountains"], ["scenery", "a campfire at night"],
];
/** Câu mô tả nhóm ẢNH KHÔNG LIÊN QUAN — mã `kind` để app báo lý do. */
const BAD = [
  ["food", "a photo of food"], ["food", "a plate of food on a table"], ["food", "a drink in a glass"],
  ["vehicle", "a motorbike"], ["vehicle", "a car"], ["vehicle", "a bus"],
  ["person", "a selfie close-up of a face"], ["person", "a portrait of a person"],
  ["screen", "a screenshot of a phone screen"], ["screen", "a document with text"], ["screen", "a logo"],
  ["other", "a cartoon illustration"], ["other", "a dog"], ["other", "a cat"], ["other", "a plain solid color background"],
  ["other", "a product photo"], ["other", "clothes and fashion"], ["other", "a busy city street"], ["other", "an office"],
  ["other", "a classroom"], ["other", "a shopping mall"],
];
const PROMPTS = [...GOOD, ...BAD];

let processor = null;
let model = null;
/** Vector chuẩn hoá của từng câu mô tả (PROMPTS), tính 1 lần lúc nạp. */
let promptVecs = null;
let loading = null;

function normalize(arr) {
  let n = 0;
  for (const x of arr) n += x * x;
  n = Math.sqrt(n) || 1;
  return arr.map((x) => x / n);
}

function load() {
  if (!loading) {
    loading = (async () => {
      const t0 = Date.now();
      processor = await AutoProcessor.from_pretrained(MODEL);
      model = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: DTYPE });
      // Nhánh chữ chỉ dùng 1 lần để tính vector các câu mô tả, xong thì bỏ (giải phóng RAM).
      const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
      const textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: DTYPE });
      const { text_embeds } = await textModel(tokenizer(PROMPTS.map((p) => p[1]), { padding: true, truncation: true }));
      const D = text_embeds.dims[1];
      promptVecs = PROMPTS.map((_, i) => normalize(Array.from(text_embeds.data.slice(i * D, (i + 1) * D))));
      await textModel.dispose?.();
      console.log(`[embedder] nạp ${MODEL_TAG} xong sau ${Date.now() - t0}ms`);
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

// Hàng đợi tuần tự — mỗi lúc chỉ chạy 1 ảnh (tránh tranh CPU, RAM ổn định).
let chain = Promise.resolve();
function serial(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function embed(buf) {
  await load();
  const image = await RawImage.fromBlob(new Blob([buf]));
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  const v = normalize(Array.from(image_embeds.data));
  // Phân loại: softmax(100 · cos) trên mọi câu mô tả, cộng xác suất nhóm GOOD.
  const logits = promptVecs.map((t) => {
    let s = 0;
    for (let i = 0; i < t.length; i++) s += t[i] * v[i];
    return 100 * s;
  });
  const mx = Math.max(...logits);
  const ex = logits.map((x) => Math.exp(x - mx));
  const Z = ex.reduce((a, b) => a + b, 0);
  const relevant = ex.slice(0, GOOD.length).reduce((a, b) => a + b, 0) / Z;
  const best = logits.indexOf(mx);
  return {
    vec: v.map((x) => Math.round(x * 1e6) / 1e6),
    relevant: Math.round(relevant * 1000) / 1000,
    kind: best < GOOD.length ? (GOOD[best][0] === "scenery" ? "scenery" : "room") : BAD[best - GOOD.length][0],
  };
}

if (process.argv.includes("--download")) {
  await load();
  // Chạy thử 1 ảnh 8×8 để chắc mô hình dùng được ngay trong ảnh Docker.
  const { default: sharpMod } = await import("sharp").catch(() => ({ default: null }));
  if (sharpMod) {
    const png = await sharpMod({ create: { width: 8, height: 8, channels: 3, background: "#7fb" } }).png().toBuffer();
    const r = await embed(png);
    console.log(`[embedder] thử OK, ${r.vec.length} chiều, kind=${r.kind}`);
  }
  process.exit(0);
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, model: MODEL_TAG, ready: Boolean(model) });
  if (req.method !== "POST" || req.url !== "/embed") return send(res, 404, { error: "not found" });
  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on("data", (c) => {
    size += c.length;
    if (size > MAX_BYTES) {
      aborted = true;
      send(res, 413, { error: "ảnh quá lớn" });
      req.destroy();
    } else chunks.push(c);
  });
  req.on("end", () => {
    if (aborted) return;
    const buf = Buffer.concat(chunks);
    if (!buf.length) return send(res, 400, { error: "thiếu ảnh" });
    serial(() => embed(buf))
      .then((r) => send(res, 200, { ...r, model: MODEL_TAG }))
      .catch((e) => {
        console.error("[embedder] lỗi", e?.message || e);
        send(res, 422, { error: "không đọc được ảnh" });
      });
  });
});

server.listen(PORT, () => console.log(`[embedder] nghe cổng ${PORT}`));
load().catch((e) => console.error("[embedder] nạp mô hình lỗi", e));
