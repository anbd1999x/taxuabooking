// Chụp màn hình ở kích thước điện thoại qua CDP: node zz-shot.mjs <url> <tệp.png> [chờ ms] [js chạy trước khi chụp]
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
const [url, out, waitMs = "9000", js = ""] = process.argv.slice(2);
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "edge-shot-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, "--window-size=390,844", "about:blank"], { stdio: "ignore" });
try {
  let t;
  for (let i = 0; i < 40 && !t; i++) { await sleep(300); try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === "page"); } catch {} }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.navigate", { url });
  await sleep(Number(waitMs));
  let clip;
  if (js) { const r = await send("Runtime.evaluate", { expression: `(async()=>{${js}})()`, awaitPromise: true, returnByValue: true }); console.log("js:", JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description)); clip = r.result?.result?.value?.clip; await sleep(1500); }
  const shot = await send("Page.captureScreenshot", clip ? { format: "png", captureBeyondViewport: true, clip: { ...clip, scale: 1 } } : { format: "png" });
  fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log("đã chụp", out);
  ws.close();
} finally {
  edge.kill();
  await sleep(400);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
}
