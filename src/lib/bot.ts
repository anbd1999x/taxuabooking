import "server-only";
import { headers } from "next/headers";

/* Nhận diện bot / công cụ AI / trình tải tự động theo user-agent.
   Dùng để gửi HTML đầy đủ ngay (không bọc <Suspense>): bot không chạy JS sẽ chỉ thấy
   nội dung nằm trong <div hidden> nếu trang trả về dạng streaming.
   Regex cố ý rộng — nhận nhầm một người thật chỉ làm họ mất khung chờ, không sai nội dung. */
const BOT_RE =
  /bot|crawl|spider|slurp|GPT|OAI|Claude|anthropic|Perplexity|Bytespider|Amazonbot|Applebot|facebookexternalhit|meta-external|cohere|DuckAssist|YouBot|Mistral|Google-Extended|bingpreview|headless|lighthouse|curl|wget|python-requests|Go-http-client|node-fetch|axios/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  if (!s) return true; // UA rỗng: không phải trình duyệt thật
  return BOT_RE.test(s);
}

export async function isBotRequest(): Promise<boolean> {
  const h = await headers();
  return isBotUserAgent(h.get("user-agent"));
}
