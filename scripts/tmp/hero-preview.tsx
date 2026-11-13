import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import { HeroScene } from "../../src/components/home/HeroScene";

const lead = "Lên Tà Xùa săn mây,", rest = "mọi thứ có ở đây.";
const html = renderToStaticMarkup(
  <header className="relative isolate flex min-h-[680px] flex-col justify-end overflow-hidden sm:min-h-[720px]">
    <HeroScene />
    <div className="container-page flex flex-col gap-5 pb-28 pt-12 text-white sm:pb-36">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold uppercase tracking-[.22em] sm:text-xs">
        <svg width="26" height="14" viewBox="0 0 26 14" className="flex-none"><path d="M7 1 L13 7 L7 13 L1 7 Z" fill="oklch(0.6 0.21 25)" /><path d="M7 4 L10 7 L7 10 L4 7 Z" fill="oklch(0.84 0.15 88)" /><path d="M19 1 L25 7 L19 13 L13 7 Z" fill="none" stroke="oklch(0.84 0.15 88)" strokeWidth="1.4" /><rect x="17.6" y="5.6" width="2.8" height="2.8" fill="oklch(0.66 0.22 355)" /></svg>
        <span>Tà Xùa · Bắc Yên · Sơn La</span>
        <span className="hidden h-px w-10 bg-white/50 sm:block" />
        <span className="font-mono text-[11px] font-semibold tracking-[.1em] text-white/80">21°16′B · 104°26′Đ · 2.865 m</span>
      </div>
      <h1 className="max-w-[980px] text-[clamp(40px,7.4vw,96px)] font-extrabold leading-[.98] tracking-[-.04em]" style={{ textWrap: "balance", textShadow: "0 2px 30px oklch(0.15 0.06 270 / .45)" } as never}>
        {lead}{" "}
        <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(100deg, oklch(0.93 0.1 88) 0%, oklch(0.86 0.15 72) 45%, oklch(0.8 0.16 48) 100%)", textShadow: "none" }}>{rest}</span>
      </h1>
      <p className="max-w-[580px] text-base leading-relaxed text-white/90 sm:text-[19px]">Xe cabin, homestay, xe máy, xe ôm, taxi. Chọn ngày là thấy giá và chỗ trống, gửi yêu cầu là có người gọi lại xác nhận.</p>
      <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-semibold text-white/85 sm:flex">
        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.08em] text-white backdrop-blur">Mùa mây T10 – T4</span>
        <span>Xe cabin đêm từ Hà Nội</span><span className="h-1 w-1 rounded-full bg-white/60" /><span>Homestay view biển mây</span>
      </div>
    </div>
  </header>,
);
const phase = process.argv[2] ?? "day";
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<style>body{margin:0;font-family:'Be Vietnam Pro',system-ui,sans-serif;background:#f4f6f4}.container-page{max-width:1240px;margin:0 auto;padding-left:clamp(16px,4vw,40px);padding-right:clamp(16px,4vw,40px);width:100%}</style></head>
<body><div style="height:64px;background:white"></div>${html}<div class="container-page" style="margin-top:-96px;position:relative;z-index:10"><div style="height:120px;background:white;border-radius:22px;box-shadow:0 24px 60px -20px rgba(30,60,45,.35)"></div></div>
<script>
const q=(s)=>document.querySelector(s), ph=${JSON.stringify(phase)};
// mô phỏng một thời điểm trong chu kỳ để xem tĩnh
const S={day:{dawn:0,day:1,tint:0,sun:[0,0.16],star:0,lamp:0,glow:.3},dawn:{dawn:1,day:0,tint:.12,sun:[-0.14,0.47],star:0,lamp:.4,glow:1},night:{dawn:0,day:0,tint:.5,sun:[0,2],star:.8,lamp:1,glow:0}}[ph];
const host=q('[data-sun]').parentElement.parentElement,H=host.offsetHeight,W=host.offsetWidth;
q('[data-dawn]').style.opacity=S.dawn;q('[data-day]').style.opacity=S.day;q('[data-tint]').style.opacity=S.tint;q('[data-glow]').style.opacity=S.glow;
q('[data-sun]').style.transform='translate('+S.sun[0]*W+'px,'+S.sun[1]*H+'px)';
document.querySelectorAll('[data-star]').forEach(e=>e.style.opacity=S.star);document.querySelectorAll('[data-lamp]').forEach(e=>e.style.opacity=S.lamp);
const narrow=innerWidth<760;q('svg[data-scene]').setAttribute('preserveAspectRatio',narrow?'xMaxYMax slice':'xMidYMax slice');
const road=q('[data-road]'),L=road.getTotalLength(),k=narrow?3:1;
const place=(g,pos,flip)=>{const d=L*pos,a=road.getPointAtLength(d-6),b=road.getPointAtLength(d+6),p=road.getPointAtLength(d);g.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+') scale('+(flip?-k:k)+' '+k+')');g.style.opacity=1};
place(q('[data-bus]'),narrow?.56:.42,false);place(q('[data-bike]'),narrow?.84:.74,true);
document.querySelectorAll('[data-bird]').forEach((e,i)=>e.style.transform='translate('+(W*(.2+i*.14))+'px,'+(H*(.16+(i%3)*.06))+'px)');
</script></body></html>`;
fs.writeFileSync(process.argv[3], page);
console.log("ok", page.length);
