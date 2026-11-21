"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * Hai nhân vật chibi thổ cẩm của cụm nút liên hệ nổi (theo claude.ai/design `Nut Lien he.dc.html`):
 * - <GirlChibi/> ngồi trên đám mây phía trên nút Zalo, đung đưa chân;
 * - <BoyChibi/> đội mũ đứng cạnh nút Gọi.
 * Kịch bản lặp 10 giây: 4 giây đầu cậu phất cờ đỏ sao vàng + cô giơ tay vẫy; 6 giây sau cậu cầm máy ảnh chụp
 * (đèn flash) + cô tạo dáng ✌ có tim bay. Bóng thoại đổi câu theo từng giây. Chỉ trang trí (pointer-events: none).
 */

/** "a:b;c-d:e" → style object (giữ nguyên CSS của bản thiết kế). */
function css(s: string): CSSProperties {
  const o: Record<string, string> = {};
  for (const part of s.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    o[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = part.slice(i + 1).trim();
  }
  return o as CSSProperties;
}
const S = ({ s, children }: { s: string; children?: ReactNode }) => <span style={css(`position:absolute;${s}`)}>{children}</span>;

/** Nhịp chung 0–9 (theo đồng hồ ⇒ 2 nhân vật luôn khớp nhau dù mỗi bên tự đếm). */
export function useChibiTick(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const tick = () => setT(Math.floor(Date.now() / 1000) % 10);
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

const SKIN = "oklch(0.9 0.04 60)";
const NAVY = "oklch(0.3 0.07 265)";
const RED = "oklch(0.6 0.22 20)";
const GOLD = "oklch(0.88 0.15 92)";
const GREEN = "oklch(0.55 0.15 155)";
const PINK = "oklch(0.68 0.2 350)";
const HAIR = "oklch(0.24 0.03 40)";

const BOY_SAY = ["Cười lên nào!", "Tách! Mây đẹp quá!", "Đứng giữa biển mây nha!", "Tách tách!", "Xinh như hoa ban!", "Một tấm nữa!"];
const GIRL_SAY = ["Chụp đi nè ✌", "Lấy cả mây nha!", "Nghiêng xíu~", "Váy thổ cẩm xinh chưa?", "Hehe ✌", "Nhắn Zalo đặt chỗ nha!"];

export function ChibiBubble({ text, pos }: { text: string; pos: string }) {
  return (
    <span
      key={text}
      className="pointer-events-none"
      style={css(
        `position:absolute;${pos};font-size:11px;font-weight:800;padding:5px 9px;border-radius:10px 10px 3px 10px;background:white;color:oklch(0.3 0.04 160);box-shadow:0 6px 14px -8px oklch(0.2 0.04 200 / .5);white-space:nowrap;animation:chBubble .3s ease both`,
      )}
    >
      {text}
    </span>
  );
}

/** Cô gái ngồi trên mây — đặt BÊN TRONG nút Zalo (position: relative, 54×54). */
export function GirlChibi() {
  const tr = useT();
  const t = useChibiTick();
  const flag = t < 4;
  const armL = flag ? "150deg" : "30deg";
  const armR = flag ? "-150deg" : "-160deg";
  const arm = `width:5px;height:13px;border-radius:3px;background:linear-gradient(180deg, ${NAVY} 0 55%, ${RED} 55% 70%, ${GOLD} 70% 80%, ${GREEN} 80%);transform-origin:top center;transition:transform .4s`;
  const eye = (side: string) => (
    <S s={`${side}:14px;bottom:37px;width:6px;height:8px;border-radius:50%;background:oklch(0.2 0.03 260);animation:chBlink 3.4s infinite`}>
      <S s="left:1px;top:1px;width:2.5px;height:2.5px;border-radius:50%;background:white" />
      <S s="right:1px;bottom:1px;width:1.2px;height:1.2px;border-radius:50%;background:white" />
    </S>
  );
  const leg = (left: number, delay: string) => (
    <S s={`left:${left}px;bottom:0;width:7px;height:14px;transform-origin:top center;animation:chLegs 1.2s ease-in-out ${delay} infinite`}>
      <S s={`inset:0 0 4px;border-radius:3px;background:${SKIN}`} />
      <S s="left:-1px;bottom:0;width:9px;height:5px;border-radius:4px 4px 3px 3px;background:oklch(0.55 0.17 15)" />
    </S>
  );
  return (
    <>
      {/* đám mây */}
      <S s="left:-10px;bottom:38px;width:74px;height:16px;pointer-events:none">
        <S s="left:0;bottom:0;width:30px;height:14px;border-radius:50%;background:white;opacity:.95" />
        <S s="left:18px;bottom:3px;width:36px;height:16px;border-radius:50%;background:white" />
        <S s="right:0;bottom:0;width:28px;height:12px;border-radius:50%;background:white;opacity:.9" />
      </S>
      <S s={`left:3px;bottom:44px;width:48px;height:66px;pointer-events:none;transform-origin:50% 100%;animation:${flag ? "chSway 1.4s ease-in-out infinite" : "chPose 1s ease-in-out infinite"}`}>
        {leg(14, "0s")}
        {leg(27, ".6s")}
        {/* váy xếp ly viền thổ cẩm */}
        <S s={`left:8px;bottom:10px;width:32px;height:12px;border-radius:4px 4px 14px 14px;background:linear-gradient(180deg, ${NAVY} 0 22%, ${RED} 22% 38%, ${GOLD} 38% 46%, ${GREEN} 46% 58%, ${PINK} 58% 72%, ${NAVY} 72%);overflow:hidden`}>
          <S s="inset:0;background:repeating-linear-gradient(90deg, oklch(0 0 0 / .14) 0 1px, transparent 1px 4px)" />
          <S s={`left:12px;top:0;width:8px;height:12px;background:oklch(0.25 0.06 265);border-left:1px solid ${RED};border-right:1px solid ${RED}`} />
        </S>
        {/* áo */}
        <S s={`left:12px;bottom:20px;width:24px;height:14px;border-radius:9px 9px 3px 3px;background:${NAVY};box-shadow:inset 0 -3px 0 ${RED}`} />
        <S s="left:15px;bottom:31px;width:18px;height:4px;border-radius:50%;border:1.5px solid oklch(0.88 0.01 250);border-top-color:transparent" />
        <S s={`left:22px;bottom:21px;width:4px;height:12px;background:linear-gradient(180deg, ${RED}, ${GOLD}, ${GREEN}, ${PINK})`} />
        {/* tay */}
        <span style={css(`position:absolute;left:9px;bottom:22px;${arm};transform:rotate(${armL})`)}>
          <S s={`left:0;bottom:-3px;width:5px;height:5px;border-radius:50%;background:${SKIN}`} />
        </span>
        <span style={css(`position:absolute;right:9px;bottom:22px;${arm};transform:rotate(${armR})`)}>
          <S s={`left:0;bottom:-3px;width:5px;height:5px;border-radius:50%;background:${SKIN}`} />
          {!flag && (
            <>
              <S s={`left:-1px;bottom:-8px;width:2px;height:6px;border-radius:1px;background:${SKIN};transform:rotate(-16deg)`} />
              <S s={`left:3px;bottom:-8px;width:2px;height:6px;border-radius:1px;background:${SKIN};transform:rotate(16deg)`} />
            </>
          )}
        </span>
        {/* tóc sau + bím */}
        <S s={`left:5px;bottom:28px;width:38px;height:34px;border-radius:50% 50% 44% 44%;background:${HAIR}`} />
        <S s={`left:-1px;bottom:30px;width:10px;height:18px;border-radius:50% 50% 60% 60%;background:${HAIR};transform:rotate(14deg)`} />
        <S s={`right:-1px;bottom:30px;width:10px;height:18px;border-radius:50% 50% 60% 60%;background:${HAIR};transform:rotate(-14deg)`} />
        <S s="left:3px;bottom:45px;width:6px;height:4px;border-radius:50%;background:oklch(0.88 0.01 250)" />
        <S s="right:3px;bottom:45px;width:6px;height:4px;border-radius:50%;background:oklch(0.88 0.01 250)" />
        {/* mặt */}
        <S s="left:9px;bottom:30px;width:30px;height:27px;border-radius:48% 48% 46% 46%;background:radial-gradient(circle at 50% 40%, oklch(0.93 0.035 60), oklch(0.88 0.05 55))" />
        {/* tóc mái + khăn thổ cẩm */}
        <S s={`left:10px;bottom:46px;width:28px;height:7px;border-radius:10px 10px 3px 3px;background:${HAIR}`} />
        <S s={`left:4px;bottom:50px;width:40px;height:16px;border-radius:20px 20px 8px 8px;background:linear-gradient(180deg, oklch(0.62 0.22 20) 0 30%, ${GOLD} 30% 42%, ${PINK} 42% 70%, ${NAVY} 70%);box-shadow:0 2px 0 oklch(0.45 0.15 20)`} />
        <S s="left:1px;bottom:47px;width:7px;height:7px;border-radius:50%;background:oklch(0.65 0.22 350)" />
        <S s={`right:1px;bottom:47px;width:7px;height:7px;border-radius:50%;background:${GOLD}`} />
        <S s="left:20px;bottom:63px;width:8px;height:8px;border-radius:50%;background:oklch(0.62 0.22 20)" />
        {/* mắt, má, miệng */}
        {eye("left")}
        {eye("right")}
        <S s="left:11px;bottom:34px;width:6px;height:3px;border-radius:50%;background:oklch(0.78 0.12 15 / .7)" />
        <S s="right:11px;bottom:34px;width:6px;height:3px;border-radius:50%;background:oklch(0.78 0.12 15 / .7)" />
        <S s={`left:21px;bottom:33px;width:6px;height:${flag ? "4px" : "5px"};border-radius:0 0 5px 5px;background:oklch(0.5 0.14 20);transition:height .3s`} />
        {!flag && (
          <>
            <S s="left:-10px;bottom:52px;font-size:11px;color:oklch(0.65 0.2 15);animation:chHeart 1.4s ease-out infinite">♥</S>
            <S s="right:-8px;bottom:58px;font-size:9px;color:oklch(0.65 0.2 15);animation:chHeart 1.4s ease-out .7s infinite">♥</S>
          </>
        )}
      </S>
      <ChibiBubble text={tr(flag ? "Mây lên rồi, đi thôi!" : GIRL_SAY[t - 4])} pos="right:48px;bottom:86px" />
    </>
  );
}

/** Chàng trai đội mũ — đặt BÊN TRONG nút Gọi (position: relative, 54×54). */
export function BoyChibi() {
  const tr = useT();
  const t = useChibiTick();
  const flag = t < 4;
  const leg = (left: number) => (
    <S s={`left:${left}px;bottom:0;width:8px;height:13px;border-radius:3px;background:oklch(0.32 0.05 250)`}>
      <S s="left:-1px;bottom:-1px;width:10px;height:5px;border-radius:4px;background:oklch(0.95 0.005 260)" />
    </S>
  );
  return (
    <>
      <S s="right:40px;bottom:6px;width:50px;height:64px;pointer-events:none;transform-origin:50% 100%;animation:chSway 1.8s ease-in-out infinite">
        {leg(17)}
        {leg(27)}
        {/* áo */}
        <S s="left:12px;bottom:10px;width:28px;height:20px;border-radius:11px 11px 6px 6px;background:oklch(0.27 0.06 265)" />
        <S s={`left:16px;bottom:24px;width:20px;height:5px;border-radius:0 0 8px 8px;background:linear-gradient(90deg, ${RED}, ${GOLD}, ${GREEN}, ${PINK})`} />
        <S s={`left:12px;bottom:11px;width:28px;height:5px;background:${RED}`} />
        <S s={`left:32px;bottom:5px;width:5px;height:9px;border-radius:0 0 2px 2px;background:${RED}`} />
        {/* tay phải buông */}
        <S s={`right:7px;bottom:14px;width:6px;height:13px;border-radius:3px;background:linear-gradient(180deg, oklch(0.27 0.06 265) 0 60%, ${GREEN} 60% 75%, ${RED} 75%);transform:rotate(-24deg)`}>
          <S s="left:0;bottom:-3px;width:6px;height:6px;border-radius:50%;background:oklch(0.88 0.05 55)" />
        </S>
        {flag ? (
          /* phất cờ đỏ sao vàng */
          <S s="left:6px;bottom:20px;width:4px;height:40px;transform-origin:50% 100%;animation:chWave .7s ease-in-out infinite">
            <S s="left:1px;top:0;width:2px;height:40px;border-radius:1px;background:oklch(0.5 0.05 60)" />
            <S s="left:3px;top:1px;width:24px;height:16px;border-radius:1px;background:oklch(0.58 0.22 27);transform-origin:left center;animation:chFlap .35s ease-in-out infinite;box-shadow:inset -3px 0 0 oklch(0.52 0.2 27)">
              <S s="left:7px;top:3px;width:10px;height:10px;background:oklch(0.92 0.17 95);clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)" />
            </S>
            <S s="left:-4px;bottom:2px;width:10px;height:9px;border-radius:50%;background:oklch(0.88 0.05 55)" />
          </S>
        ) : (
          /* cầm máy ảnh chụp */
          <S s="left:0;bottom:30px;width:22px;height:15px;border-radius:4px;background:linear-gradient(180deg, oklch(0.32 0.02 260), oklch(0.22 0.02 260));animation:chSnap 1s infinite">
            <S s="left:6px;top:2px;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 35%, oklch(0.7 0.08 240), oklch(0.3 0.05 250));border:2px solid oklch(0.75 0.01 260)" />
            <S s="left:2px;top:-3px;width:6px;height:3px;border-radius:1px 1px 0 0;background:oklch(0.3 0.02 260)" />
            <S s="right:2px;top:2px;width:3px;height:2px;border-radius:1px;background:oklch(0.85 0.12 90)" />
            <S s="left:-12px;top:-14px;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle, white 18%, oklch(1 0 0 / 0) 70%);animation:chFlash 1s infinite" />
            <S s="left:-3px;bottom:-4px;width:8px;height:8px;border-radius:50%;background:oklch(0.88 0.05 55)" />
          </S>
        )}
        {/* đầu + mũ */}
        <S s="left:10px;bottom:27px;width:32px;height:28px;border-radius:48% 48% 46% 46%;background:radial-gradient(circle at 50% 40%, oklch(0.92 0.04 60), oklch(0.86 0.055 55))" />
        <S s="left:8px;bottom:39px;width:5px;height:7px;border-radius:50%;background:oklch(0.86 0.055 55)" />
        <S s={`left:12px;bottom:46px;width:28px;height:9px;border-radius:14px 14px 4px 4px;background:oklch(0.22 0.03 40)`} />
        <S s="left:9px;bottom:47px;width:34px;height:13px;border-radius:17px 17px 3px 3px;background:oklch(0.2 0.03 265)" />
        <S s={`left:9px;bottom:47px;width:34px;height:3px;background:linear-gradient(90deg, ${RED}, ${GOLD}, ${GREEN}, ${RED})`} />
        <S s={`left:22px;bottom:58px;width:8px;height:8px;border-radius:50%;background:${RED}`} />
        {/* mắt (nheo 1 bên khi chụp), má, miệng */}
        <S s={`left:16px;bottom:34px;width:6px;height:${flag ? "8px" : "2px"};border-radius:50%;background:oklch(0.2 0.03 260);animation:chBlink 3.8s infinite;transition:height .2s`}>
          <S s={`left:1px;top:1px;width:2.5px;height:2.5px;border-radius:50%;background:white;opacity:${flag ? 1 : 0}`} />
        </S>
        <S s="right:16px;bottom:34px;width:6px;height:8px;border-radius:50%;background:oklch(0.2 0.03 260);animation:chBlink 3.8s infinite">
          <S s="left:1px;top:1px;width:2.5px;height:2.5px;border-radius:50%;background:white" />
        </S>
        <S s="left:13px;bottom:31px;width:6px;height:3px;border-radius:50%;background:oklch(0.78 0.12 15 / .7)" />
        <S s="right:13px;bottom:31px;width:6px;height:3px;border-radius:50%;background:oklch(0.78 0.12 15 / .7)" />
        <S s="left:23px;bottom:30px;width:7px;height:4px;border-radius:0 0 5px 5px;background:oklch(0.5 0.14 20)" />
      </S>
      <ChibiBubble text={tr(flag ? "Đi săn mây Tà Xùa thôi!" : BOY_SAY[t - 4])} pos="right:66px;bottom:66px" />
    </>
  );
}

/** Keyframes của 2 nhân vật + cụm nút (đặt 1 lần). Tắt chuyển động khi người dùng chọn giảm chuyển động. */
export const CHIBI_CSS = `
@keyframes chBlink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes chWave{0%,100%{transform:rotate(-26deg)}50%{transform:rotate(16deg)}}
@keyframes chFlap{0%,100%{transform:skewY(0) scaleX(1)}50%{transform:skewY(-9deg) scaleX(.88)}}
@keyframes chSway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes chPose{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(6deg) translateY(-1px)}}
@keyframes chLegs{0%,100%{transform:rotate(8deg)}50%{transform:rotate(-14deg)}}
@keyframes chFlash{0%,70%,100%{opacity:0;transform:scale(.4)}78%{opacity:1;transform:scale(1.4)}}
@keyframes chSnap{0%,70%,100%{transform:none}78%{transform:translateY(1px) scale(.95)}}
@keyframes chHeart{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translateY(-24px) scale(1.1)}}
@keyframes chPop{from{opacity:0;transform:translateY(10px) scale(.8)}to{opacity:1;transform:none}}
@keyframes chHalo{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.55);opacity:0}}
@keyframes chBubble{from{opacity:0;transform:translateY(4px) scale(.9)}to{opacity:1;transform:none}}
@keyframes fcRise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.fc-stack *{animation:none!important}}
`;
