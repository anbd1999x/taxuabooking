// Kiểm thử luồng đặt phòng trang chi tiết homestay bằng trình duyệt thật (Edge không giao diện, điều khiển qua CDP).
// KHÔNG tạo đơn thật: yêu cầu POST /api/bookings bị chặn ở trình duyệt, chỉ ghi lại nội dung gửi đi rồi trả kết quả giả.
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const SLUG = process.argv[2] || "la-cheu-homestay";
const FROM = process.argv[3] || "2026-11-27", TO = process.argv[4] || "2026-11-29";
const fd = Number(FROM.slice(8)), td = Number(TO.slice(8)), MM = FROM.slice(5, 7), A = fd - 3, B = fd - 1;
const p2 = (n) => String(n).padStart(2, "0");
const PORT = 9333;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, cond, extra = "") => { results.push(cond); console.log(`${cond ? "✓" : "✗ LỖI"} ${name}${extra ? " — " + extra : ""}`); };

const prof = fs.mkdtempSync(path.join(os.tmpdir(), "edge-e2e-"));
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, process.env.MOBILE ? "--window-size=390,844" : "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(300);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("không mở được trình duyệt");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  const captured = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      if (/\/api\/bookings/.test(request.url) && request.method === "POST") {
        captured.push(JSON.parse(request.postData || "{}"));
        send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify({ code: "TX-HT-TEST1", needsConfirmation: true })).toString("base64") });
      } else if (/\/api\/track/.test(request.url)) send("Fetch.fulfillRequest", { requestId, responseCode: 204 }); // không ghi lượt truy cập thử vào thống kê
      else send("Fetch.continueRequest", { requestId });
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "lỗi JS");
    return r.result?.result?.value;
  };
  await send("Page.enable");
  if (process.env.MOBILE) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/bookings*" }, { urlPattern: "*/api/track*" }] });
  const jsErrors = [];
  const origOnMsg = ws.onmessage;
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === "Runtime.exceptionThrown") jsErrors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? "?"); origOnMsg(e); };

  // Hàm tiện ích chạy trong trang
  const HELP = `
    const T=(el)=>(el?.innerText||"").replace(/\\s+/g," ").trim();
    const money=(s)=>{const m=(s||"").match(/([\\d.]+)đ/);return m?Number(m[1].replace(/\\./g,"")):null};
    const cards=()=>[...document.querySelectorAll('[data-sec="ph"] article')];
    const vis=(c)=>[...c.querySelectorAll("[data-card]")].find(x=>x.offsetParent!==null)||c;
    const btnOf=(c)=>[...vis(c).querySelectorAll("button, a[href]")].pop();
    const aside=()=>document.querySelector("aside");
    const setVal=(el,v)=>{const p=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));};
    const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  `;

  // Giá server cho cùng kỳ (computeAvailability) để đối chiếu với giá thẻ phòng trên trang
  const page0 = await (await fetch(`${BASE}/homestay/${SLUG}`)).text();
  const sid = (page0.match(/serviceId\\?":\\?"([a-z0-9]+)/) || [])[1];
  ok("tìm thấy serviceId trong trang", !!sid, sid);
  const avail = sid ? await (await fetch(`${BASE}/api/availability?serviceId=${sid}&from=${FROM}&to=${TO}`)).json() : null;
  const srvOpts = avail?.stayOptions ?? [];
  console.log("  server trả", srvOpts.length, "lựa chọn phòng; khoá:", srvOpts[0] ? Object.keys(srvOpts[0]).join(",") : "-");

  await send("Page.navigate", { url: `${BASE}/homestay/${SLUG}?from=${FROM}&to=${TO}&adults=3` });
  for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`${HELP} return cards().length>0 && !!aside()`)) break; }
  await sleep(1500);

  // 1. Ngày từ URL được chọn sẵn
  const pill = await ev(`${HELP} return T(document.querySelector('[data-sec="ph"]')).slice(0,220)`);
  ok("ngày từ URL chọn sẵn", pill.includes(`${p2(fd)}/${MM} → ${p2(td)}/${MM} · 2 đêm · 3 khách`), pill.slice(0, 110));

  // 2. Giá từng thẻ phòng khớp giá server
  const cardData = await ev(`${HELP} const mm=[...document.querySelectorAll('[data-sec="ph"] button')].find(b=>/^Xem thêm \\d+ phòng$/.test(T(b))); if(mm){mm.click();await wait(300);} return cards().map(c=>({name:T(vis(c).querySelector("b")),price:money(T(vis(c).querySelector("[data-price]"))),btn:T(btnOf(c)),disabled:btnOf(c).disabled,txt:T(c).slice(0,160)}))`);
  console.log("  thẻ phòng đối chiếu:", cardData.length, "/ server", srvOpts.length);
  if (srvOpts.length) {
    const byName = new Map(srvOpts.map((o) => [String(o.name).split(" · ").pop().trim(), o]));
    let cmp = 0, diff = [];
    for (const c of cardData) {
      const o = byName.get(c.name);
      if (!o) continue;
      const sp = o.pricePerUnit ?? null;
      cmp++;
      if (sp != null && c.price != null && sp !== c.price) diff.push(`${c.name}: web ${c.price} ≠ server ${sp}`);
      const sFree = o.bookable;
      if (typeof sFree === "boolean" && sFree === c.disabled) diff.push(`${c.name}: tình trạng web ${!c.disabled} ≠ server ${sFree}`);
    }
    ok(`giá + tình trạng thẻ phòng khớp server (${cmp} phòng đối chiếu)`, cmp > 0 && diff.length === 0, diff.slice(0, 5).join("; "));
  }

  // 3. Đổi ngày bằng lịch rồi quay về kỳ ban đầu
  const cal = await ev(`${HELP}
    const day=(n)=>[...document.querySelectorAll('[data-sec="ph"] button')].find(b=>b.className.includes("h-[58px]")&&T(b).split(" ")[0]===String(n)&&!b.disabled);
    const a=day(${A}); if(!a) return "không có ô ${A}"; a.click(); await wait(200);
    const one=T(document.querySelector('[data-sec="ph"]')).match(/\\d\\d\\/\\d\\d → \\d\\d\\/\\d\\d · \\d+ đêm/)?.[0];
    const b=day(${B}); if(!b) return one+" | không có ô ${B}"; b.click(); await wait(200);
    const two=T(document.querySelector('[data-sec="ph"]')).match(/\\d\\d\\/\\d\\d → \\d\\d\\/\\d\\d · \\d+ đêm/)?.[0];
    day(${fd}).click(); await wait(150); day(${td}).click(); await wait(300);
    const back=T(document.querySelector('[data-sec="ph"]')).match(/\\d\\d\\/\\d\\d → \\d\\d\\/\\d\\d · \\d+ đêm/)?.[0];
    return [one,two,back].join(" | ")`);
  ok("bấm lịch: 1 ngày = 1 đêm, bấm ngày thứ hai = khoảng đêm, đổi lại kỳ cũ", cal === `${p2(A)}/${MM} → ${p2(A + 1)}/${MM} · 1 đêm | ${p2(A)}/${MM} → ${p2(B)}/${MM} · 2 đêm | ${p2(fd)}/${MM} → ${p2(td)}/${MM} · 2 đêm`, cal);

  // 4. Chip lọc chỉ lọc hiển thị
  const flt = await ev(`${HELP}
    const chips=[...document.querySelectorAll('[data-sec="ph"] button')].filter(b=>/^(Tất cả|Còn trống|1–2 khách|Gia đình · nhóm|View mây|Bồn tắm) \\d+$/.test(T(b)));
    const out=[];
    for(const c of chips){c.click();await wait(150);const n=Number(T(c).match(/\\d+$/)[0]);const more=[...document.querySelectorAll('[data-sec="ph"] button')].find(b=>/^Xem thêm \\d+ phòng$/.test(T(b)));const shown=cards().length+(more?Number(T(more).match(/\\d+/)[0]):0);out.push(T(c)+"→"+shown+(shown===n?"":" SAI"));}
    chips[0].click(); await wait(150);
    const more=[...document.querySelectorAll('[data-sec="ph"] button')].find(b=>/^Xem thêm \\d+ phòng$/.test(T(b))); if(more){more.click();await wait(200);}
    return out.join(", ")+" | sau Xem thêm: "+cards().length`);
  ok("chip lọc: số phòng hiện đúng bằng số trên chip", !/SAI/.test(flt), flt);

  // 5. Chọn 2 phòng còn trống ⇒ bill
  const pick = await ev(`${HELP}
    const free=cards().filter(c=>!btnOf(c).disabled).slice(0,2); if(free.length<2) return {err:"không đủ 2 phòng trống"};
    const picked=[];
    for(const c of free){picked.push({name:T(vis(c).querySelector("b")),price:money(T(vis(c).querySelector("[data-price]"))),strike:money(T(vis(c).querySelector(".line-through")))});btnOf(c).click();await wait(250);}
    const a=aside(); const tot=[...a.querySelectorAll("span")].find(s=>s.className.includes("text-2xl")&&/đ$/.test(T(s)));
    return {picked,total:money(T(tot)),aside:T(a).slice(0,700),labels:cards().filter(c=>/Đã chọn/.test(T(btnOf(c)))).length,borders:0}`);
  if (pick.err) ok("chọn 2 phòng", false, pick.err);
  else {
    const sum = pick.picked.reduce((n, p) => n + p.price, 0);
    ok("chọn 2 phòng: nút đổi thành '✓ Đã chọn'", pick.labels === 2, `${pick.picked.map((p) => p.name).join(" + ")}`);
    ok("bill: tạm tính = tổng giá 2 phòng (3 khách, không phụ thu)", pick.total === sum, `tạm tính ${pick.total} · tổng thẻ ${sum}`);
    ok("bill: hiện đủ 2 dòng phòng", pick.picked.every((p) => pick.aside.includes(p.name)));
  }

  // 6. Thêm khách vượt sức chứa ⇒ cảnh báo / phụ thu, rồi trả về 3
  const cap = await ev(`${HELP}
    const a=aside(); const plus=[...a.querySelectorAll("button")].filter(b=>T(b)==="+")[0]; const minus=[...a.querySelectorAll("button")].filter(b=>T(b)==="−")[0];
    const tot=()=>money(T([...a.querySelectorAll("span")].find(s=>s.className.includes("text-2xl"))));
    const t0=tot(); for(let i=0;i<9;i++){plus.click();await wait(40);} await wait(200);
    const warn=/Vượt tối đa|vượt chuẩn/.test(T(a)); const t1=tot();
    for(let i=0;i<9;i++){minus.click();await wait(40);} await wait(200);
    return {t0,t1,warn,t2:tot()}`);
  ok("tăng lên 12 khách ⇒ báo vượt sức chứa / phụ thu; giảm về 3 ⇒ tổng trở lại", cap.warn && cap.t2 === cap.t0, JSON.stringify(cap));

  // 7. Kiểm tra form: thiếu tên, sai SĐT
  const v1 = await ev(`${HELP} const a=aside(); const sb=[...a.querySelectorAll("button")].find(b=>/Gửi yêu cầu đặt/.test(T(b))); sb.click(); await wait(250); return T(a.querySelector(".text-red-600"))`);
  ok("gửi khi thiếu tên ⇒ báo lỗi, không gửi", /họ tên/i.test(v1) && captured.length === 0, v1);
  const v2 = await ev(`${HELP} const a=aside(); const [n,p]=a.querySelectorAll('input:not([type=number])'); setVal(n,"Khách Thử Nghiệm"); setVal(p,"0900000000"); await wait(100);
    [...a.querySelectorAll("button")].find(b=>/Gửi yêu cầu đặt/.test(T(b))).click(); await wait(250); return T(a.querySelector(".text-red-600"))`);
  ok("SĐT giả (0900000000) ⇒ báo lỗi, không gửi", v2.length > 0 && captured.length === 0, v2.slice(0, 70));

  // 8. Gửi đơn hợp lệ (bị chặn ở trình duyệt, không tới server)
  const done = await ev(`${HELP} const a=aside(); const ins=a.querySelectorAll('input:not([type=number])'); setVal(ins[1],"0903217468"); const ta=a.querySelector("textarea"); setVal(ta,"Đơn thử tự động"); await wait(100);
    const sb=[...a.querySelectorAll("button")].find(b=>/Gửi yêu cầu đặt/.test(T(b))); const label=T(sb); (${process.env.BAR ? 1 : 0}?document.querySelector("div.fixed.bottom-0 button"):sb).click(); await wait(1500); return {label,aside:T(aside()).slice(0,260)}`);
  const body = captured[0];
  ok("nút ghi 'Gửi yêu cầu đặt 2 phòng'", /Gửi yêu cầu đặt 2 phòng/.test(done.label), done.label);
  ok("đúng 1 yêu cầu POST /api/bookings được gửi", captured.length === 1, `số lần gửi: ${captured.length}`);
  if (body) {
    console.log("  nội dung gửi:", JSON.stringify(body));
    ok("payload: serviceId đúng", body.serviceId === sid);
    ok("payload: ngày nhận/trả đúng", body.useDate === FROM && body.endDate === TO, `${body.useDate} → ${body.endDate}`);
    ok("payload: 2 phòng, roomId = phòng đầu, roomIds đủ", body.quantity === 2 && Array.isArray(body.roomIds) && body.roomIds.length === 2 && body.roomId === body.roomIds[0] && new Set(body.roomIds).size === 2);
    ok("payload: số khách, tên, SĐT, ghi chú", body.adults === 3 && Array.isArray(body.childrenAges) && body.customerName === "Khách Thử Nghiệm" && body.phone === "0903217468" && body.note === "Đơn thử tự động" && body.email === null);
    ok("payload: đủ đúng các trường như bản cũ", Object.keys(body).sort().join(",") === "adults,childrenAges,customerName,email,endDate,note,phone,quantity,roomId,roomIds,roomTypeId,serviceId,useDate", Object.keys(body).sort().join(","));
    if (srvOpts.length) {
      const ids = new Set(srvOpts.map((o) => o.id));
      ok("payload: roomIds là phòng thật của homestay này (theo server)", body.roomIds.every((id) => ids.has(id)));
    }
  }
  ok("màn 'Đã gửi yêu cầu' hiện mã đơn", /Đã gửi yêu cầu/i.test(done.aside) && /TX-HT-TEST1/.test(done.aside), done.aside.slice(0, 90));
  ok("không có lỗi JavaScript trong trang", jsErrors.length === 0, jsErrors.slice(0, 2).join(" | "));
  ws.close();
} finally {
  edge.kill();
  await sleep(500);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
}
const bad = results.filter((x) => !x).length;
console.log(`\n${results.length - bad}/${results.length} mục đạt${bad ? ` — ${bad} mục LỖI` : ""}`);
process.exit(bad ? 1 : 0);
