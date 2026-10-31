/**
 * Markdown tối giản → HTML cho bài viết (chuẩn SEO: h2/h3 thật, p, danh sách,
 * ảnh, link). Toàn bộ input được escape trước nên an toàn khi render.
 *
 * Hỗ trợ:  ## Tiêu đề mục   ### Tiêu đề nhỏ   - gạch đầu dòng   > trích dẫn
 *          **đậm**  *nghiêng*  [chữ](https://link)  ![mô tả ảnh](/uploads/x.jpg)
 * Dòng trống tách đoạn. Văn bản thường thành <p>.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Inline: đậm/nghiêng/link (chạy trên chuỗi ĐÃ escape). */
function inline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_m, text, href) => {
      const ext = /^https?:\/\//.test(href) && !href.includes("taxuabooking");
      return `<a href="${href}"${ext ? ' target="_blank" rel="noopener nofollow"' : ""}>${text}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(src: string): string {
  const lines = esc(src.replace(/\r\n?/g, "\n")).split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join("<br/>"))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      flushPara();
      flushList();
      continue;
    }
    let m = t.match(/^###\s+(.*)/);
    if (m) { flushPara(); flushList(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    m = t.match(/^##\s+(.*)/);
    if (m) { flushPara(); flushList(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    m = t.match(/^!\[([^\]]*)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)$/);
    if (m) { flushPara(); flushList(); out.push(`<img src="${m[2]}" alt="${m[1]}" loading="lazy" />`); continue; }
    m = t.match(/^[-•]\s+(.*)/);
    if (m) { flushPara(); list.push(m[1]); continue; }
    m = t.match(/^&gt;\s?(.*)/);
    if (m) { flushPara(); flushList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    flushList();
    para.push(t);
  }
  flushPara();
  flushList();
  return out.join("\n");
}
