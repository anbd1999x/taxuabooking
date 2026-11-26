"use client";

/**
 * Trang giới thiệu "Quản lý cho thuê xe" cho chủ tiệm cho thuê xe (menu Hợp tác).
 * Theo claude.ai/design project 4ec052fe… file "Gioi thieu Quan ly Xe may.dc.html".
 * Ảnh: public/hop-tac/xe-*.jpg (ảnh xe thật của các tiệm trên Tà Xùa Booking).
 */
import { useEffect, useState, type CSSProperties } from "react";
import { useSitePhone } from "@/components/SiteContact";
import { formatPhone } from "@/lib/trust-popup";

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const LINE = "oklch(0.92 0.01 160)";
/** Vào bản demo: route dựng nhà xe mẫu + phiên DEMO (src/app/(site)/hop-tac/xe-may/demo/route.ts). */
const DEMO = "/hop-tac/xe-may/demo";
const IMG = { vang: "/hop-tac/xe-vang.jpg", xanh: "/hop-tac/xe-xanh.jpg", bac: "/hop-tac/xe-bac.jpg", hong: "/hop-tac/xe-hong.jpg" };

const STEPS: [string, string, string, string[]][] = [
  ["01", "Nhập đội xe một lần", "Mỗi xe một thẻ: ảnh thật, biển số, loại xe, giá thuê, số km. Đặt xe ở chế độ sẵn sàng, bảo dưỡng hay ngừng cho thuê.", ["Biển số được kiểm tra, không trùng", "Tự nhắc thay nhớt theo số km", "Theo dõi hạn bảo hiểm từng xe"]],
  ["02", "Có đơn, tự xếp xe trống", "Nhập ngày nhận, ngày trả, loại xe. Hệ thống tự chọn xe trống suốt thời gian đó, ưu tiên xe tốt và ít chạy. Giá cuối tuần, ngày lễ tự cộng.", ["Không bao giờ xếp trùng lịch", "Xe bận ghi rõ lý do và ai đang giữ", "Đơn khách đặt trên website đổ thẳng về"]],
  ["03", "Giao xe có biên bản", "Lúc giao xe, nhân viên ghi số km, mức xăng, phụ kiện kèm theo, giấy tờ đang giữ, và chụp 4 góc xe. Có bằng chứng nếu xe bị trầy.", ["Chụp ảnh ngay trên điện thoại", "Nhân viên chỉ thấy việc giao và nhận", "Trạng thái xe chuyển sang Đang thuê"]],
  ["04", "Nhận xe, quyết toán tự động", "Khách trả xe muộn, thiếu xăng hay mất mũ, hệ thống tự tính phí. Biết ngay khách cần trả thêm hay mình phải hoàn cọc bao nhiêu.", ["Phí phát sinh theo bảng giá của tiệm", "Ghi tiền mặt hoặc chuyển khoản", "Nhắc trả giấy tờ cho khách"]],
];
const HERO_POINTS = ["Dùng trên điện thoại", "Tự xếp xe, không trùng lịch", "Nhận đơn từ Tà Xùa Booking"];
const PAINS = [
  ["01", "Khách hỏi “ngày 21 còn xe không?”, phải lật sổ mới biết.", "Lịch tháng hiện mọi xe, nhìn là trả lời được."],
  ["02", "Lỡ nhận trùng một xe cho hai khách.", "Hệ thống chỉ xếp xe còn trống suốt thời gian thuê."],
  ["03", "Không nhớ ai đã cọc, cọc bao nhiêu.", "Mỗi đơn ghi rõ đã thu, còn thiếu, thu bằng gì."],
  ["04", "Khách trả xe trầy, không có gì để đối chiếu.", "Biên bản giao xe có ảnh 4 góc và số km."],
];
const FEATS = [
  ["Nhắc việc mỗi sáng", "Xe cần giao, xe cần nhận, khách quá hạn, đơn chưa cọc. Bấm vào là xử lý."],
  ["Thu chi rõ ràng", "Tách tiền mặt và chuyển khoản, cọc đang giữ, còn phải thu. Tối chốt két không lệch."],
  ["Giá tự tính", "Cuối tuần, ngày lễ tự cộng, thuê dài ngày tự giảm, thuê theo giờ trong ngày."],
  ["Bảo dưỡng & bảo hiểm", "Thanh tiến độ thay nhớt theo km, hạn bảo hiểm, lịch sử sửa chữa và chi phí từng xe."],
  ["Khách quen & danh sách đen", "Biết khách đã thuê mấy lần, từng trả muộn chưa. Cảnh báo khi khách xấu đặt lại."],
  ["Báo cáo lãi từng xe", "Doanh thu, tỉ lệ thuê, chi bảo dưỡng của từng chiếc. Biết xe nào nên bán, nên mua thêm."],
  ["Quyền nhân viên", "Nhân viên giao xe chỉ thấy việc trong ngày, không thấy doanh thu."],
  ["Đơn từ Tà Xùa Booking", "Xe của tiệm hiện trên website, khách đặt đổ thẳng về, xe đã được xếp sẵn."],
];
const DAY = [
  ["07:00", "Mở điện thoại, thấy việc hôm nay", "3 xe cần giao, 2 xe nhận lại, 1 đơn web mới chờ duyệt."],
  ["08:00", "Giao xe cho khách", "Ghi số km, mức xăng, chụp 4 góc xe, giữ CCCD. Mất khoảng 2 phút."],
  ["11:30", "Đơn mới từ website", "Xe đã được xếp sẵn. Bấm xác nhận rồi nhắn Zalo cho khách chuyển cọc."],
  ["17:00", "Khách trả xe muộn 1 giờ", "Hệ thống tự tính phí trả muộn và thiếu xăng, báo số tiền khách cần trả thêm."],
  ["21:00", "Chốt két cuối ngày", "Xem tổng tiền mặt và chuyển khoản trong ngày, đối chiếu với két và sao kê."],
];
const FAQ = [
  ["Có cần cài ứng dụng không?", "Không cần. Mở bằng trình duyệt trên điện thoại hoặc máy tính, đăng nhập là dùng."],
  ["Nhân viên có xem được doanh thu không?", "Không. Tài khoản nhân viên giao xe chỉ thấy việc giao và nhận xe trong ngày."],
  ["Tiệm tôi có cả xe số, xe ga, PG-1 thì sao?", "Mỗi loại xe đặt giá riêng, giá theo giờ riêng. Khi tạo đơn chỉ cần chọn loại, hệ thống tự xếp đúng loại."],
  ["Khách đặt qua Zalo thì có ghi vào được không?", "Được. Bạn tạo đơn trong vài giây và ghi nguồn khách là Zalo, CTV hay khách quen để cuối tháng xem nguồn nào nhiều khách."],
  ["Dữ liệu trong sổ cũ có chuyển vào được không?", "Gửi tụi mình danh sách xe và các đơn đang có, tụi mình nhập giúp trong buổi cài đặt."],
];

const BAR = {
  r: ["oklch(0.58 0.13 250)", "white", "oklch(0.58 0.13 250)", "solid"],
  d: ["oklch(0.8 0.13 75)", "oklch(0.3 0.06 60)", "oklch(0.72 0.15 65)", "solid"],
  h: ["oklch(0.97 0.02 280)", "oklch(0.42 0.1 280)", "oklch(0.62 0.1 280)", "dashed"],
  m: ["oklch(0.95 0.035 28)", "oklch(0.5 0.16 28)", "oklch(0.6 0.16 28)", "dashed"],
} as const;
type BarK = keyof typeof BAR;
const LEGEND: [string, string, string, string][] = [
  ["Rảnh", "white", "oklch(0.85 0.02 160)", "solid"],
  ["Giữ chỗ", BAR.h[0], BAR.h[2], "dashed"],
  ["Đã cọc", BAR.d[0], BAR.d[2], "solid"],
  ["Đang thuê", BAR.r[0], BAR.r[2], "solid"],
  ["Bảo dưỡng", BAR.m[0], BAR.m[2], "dashed"],
];
const G_ROWS: [string, string, [number, number, BarK, string][]][] = [
  ["PG-1 Vàng", "26B2-777.15", [[0, 3, "r", "Thu Hà"], [3, 3, "d", "Minh Đức"]]],
  ["PG-1 Xanh ngọc", "26B2-781.02", [[1, 2, "d", "Lan Anh"], [6, 3, "h", "Giữ chỗ"]]],
  ["PG-1 Bạc", "26B2-850.66", [[0, 2, "r", "Tuấn"], [4, 2, "r", "Khoa"]]],
  ["PG-1 Hồng", "26B1-520.33", [[2, 4, "d", "Hải Yến"]]],
  ["Honda Wave", "26B1-234.56", [[0, 4, "m", "Bảo dưỡng"]]],
];

const eyebrow = (c: string): CSSProperties => ({ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", color: c });
const h2: CSSProperties = { margin: 0, fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-.025em" };
const wrap: CSSProperties = { maxWidth: 1200, width: "100%", margin: "0 auto", paddingLeft: "clamp(16px,4vw,32px)", paddingRight: "clamp(16px,4vw,32px)" };
const card: CSSProperties = { background: "white", borderRadius: 20, boxShadow: "0 20px 40px -24px oklch(0.2 0.05 160 / .4)", animation: "mpUp .4s ease both" };

export default function MotoPartnerLanding() {
  const sitePhone = useSitePhone().replace(/D/g, ""); // SĐT chung của web (cấu hình ở /admin/popup)
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);
  const [manual, setManual] = useState(false);
  const [faq, setFaq] = useState(0);

  // Tự chuyển bước mỗi 6 giây cho tới khi người xem tự bấm.
  useEffect(() => {
    if (manual) return;
    const raf = requestAnimationFrame(() => setTick(1));
    const iv = setInterval(() => {
      setStep((s) => (s + 1) % 4);
      setTick(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setTick(1)));
    }, 6000);
    return () => { clearInterval(iv); cancelAnimationFrame(raf); };
  }, [manual]);

  const st = STEPS[step];
  const auto = !manual;
  const fuel = ["E", "1/4", "1/2", "3/4", "Đầy"];

  return (
    <div className="mp" style={{ background: "oklch(0.975 0.008 150)", color: "oklch(0.22 0.03 160)", fontFamily: "'Be Vietnam Pro',system-ui,sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes mpUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes mpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @media (prefers-reduced-motion:reduce){.mp *{animation:none!important;transition:none!important}}
        .mp-hero{display:grid;grid-template-columns:1fr;gap:clamp(28px,5vw,64px);align-items:center}
        .mp-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .mp-step{display:grid;grid-template-columns:1fr;gap:clamp(20px,4vw,48px);align-items:center}
        .mp-ov,.mp-cta{display:grid;grid-template-columns:1fr}
        .mp-ov{gap:clamp(24px,4vw,56px);align-items:center}
        .mp-card-l{left:10px}.mp-card-r{right:10px}
        @media (min-width:560px){.mp-card-l{left:-28px}.mp-card-r{right:-24px}}
        @media (min-width:760px){.mp-steps{grid-template-columns:repeat(4,minmax(0,1fr))}}
        @media (min-width:860px){.mp-step{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}.mp-cta{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}}
        @media (min-width:900px){.mp-hero{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}}
        @media (min-width:980px){.mp-ov{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)}}
        .mp a.mp-btn:hover{filter:brightness(1.08)}
      `}</style>

      {/* HERO */}
      <section className="mp-hero" style={{ ...wrap, paddingTop: "clamp(28px,5vw,64px)", paddingBottom: "clamp(40px,6vw,80px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "mpUp .6s ease both" }}>
          <span style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 999, background: "oklch(0.95 0.03 155)", color: "oklch(0.36 0.09 158)" }}>Phần mềm quản lý tiệm cho thuê xe máy</span>
          <h1 style={{ margin: 0, fontSize: "clamp(34px,5.2vw,60px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.035em", textWrap: "balance" }}>
            Biết ngay xe nào rảnh, ai đang thuê, <span style={{ color: "oklch(0.62 0.17 45)" }}>ai đã cọc.</span>
          </h1>
          <p style={{ margin: 0, fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.6, color: "oklch(0.42 0.02 160)", maxWidth: 520, textWrap: "pretty" }}>
            Bỏ sổ tay và tin nhắn Zalo rời rạc. Mọi xe, mọi đơn, mọi khoản cọc nằm trên một màn hình, mở bằng điện thoại là dùng.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={DEMO} rel="nofollow" className="mp-btn" style={{ fontSize: 16, fontWeight: 800, padding: "15px 24px", borderRadius: 999, background: G, color: "white", whiteSpace: "nowrap" }}>Mở bản demo →</a>
            <a href="#cach-dung" className="mp-btn" style={{ fontSize: 16, fontWeight: 800, padding: "15px 22px", borderRadius: 999, border: "1.5px solid oklch(0.82 0.02 160)", color: "oklch(0.25 0.03 160)", whiteSpace: "nowrap" }}>Xem hướng dẫn sử dụng ↓</a>
          </div>
          <div style={{ display: "flex", gap: "8px 20px", flexWrap: "wrap", fontSize: 14, fontWeight: 600, color: "oklch(0.42 0.02 160)" }}>
            {HERO_POINTS.map((p) => (
              <span key={p} style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "oklch(0.62 0.12 155)" }} />{p}</span>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", maxWidth: 480, width: "100%", justifySelf: "center" }}>
          <div style={{ borderRadius: 32, overflow: "hidden", aspectRatio: "4/5", boxShadow: "0 40px 80px -40px oklch(0.2 0.05 160 / .55)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.vang} alt="Xe Yamaha PG-1 cho thuê tại Tà Xùa" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div className="mp-card-l" style={{ position: "absolute", top: "12%", width: 240, maxWidth: "calc(100% - 20px)", padding: "12px 14px", borderRadius: 18, background: "white", boxShadow: "0 20px 40px -18px oklch(0.2 0.05 160 / .45)", display: "flex", flexDirection: "column", gap: 6, animation: "mpFloat 5s ease-in-out infinite" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 800 }}>Yamaha PG-1</span><span style={{ fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: "oklch(0.58 0.13 250)", color: "white" }}>Đang thuê</span></div>
            <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>26B2-777.15</span>
            <span style={{ fontSize: 13, color: "oklch(0.4 0.02 160)" }}>Chị Thu Hà · trả 17:00 hôm nay</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.13 60)" }}>Đã cọc 180.000đ · còn 420.000đ</span>
          </div>
          <div className="mp-card-r" style={{ position: "absolute", bottom: "10%", width: 230, maxWidth: "calc(100% - 20px)", padding: "12px 14px", borderRadius: 18, background: G, color: "white", boxShadow: "0 20px 40px -18px oklch(0.2 0.05 160 / .6)", display: "flex", flexDirection: "column", gap: 6, animation: "mpFloat 5s 1.2s ease-in-out infinite" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "oklch(0.85 0.1 78)" }}>ĐƠN MỚI TỪ WEBSITE</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>2 xe PG-1 · 20 → 22/11</span>
            <span style={{ fontSize: 13, color: "oklch(0.88 0.02 160)" }}>Đã tự xếp 2 xe đang trống</span>
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section style={{ background: "oklch(0.22 0.045 165)", color: "white" }}>
        <div style={{ ...wrap, paddingTop: "clamp(48px,7vw,88px)", paddingBottom: "clamp(48px,7vw,88px)", display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
            <span style={eyebrow("oklch(0.85 0.1 78)")}>TIỆM XE THƯỜNG GẶP</span>
            <h2 style={h2}>Mùa mây đông khách, sổ tay không theo kịp.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 12 }}>
            {PAINS.map(([n, t, fix]) => (
              <div key={n} style={{ padding: 20, borderRadius: 20, background: "oklch(1 0 0 / .06)", border: "1px solid oklch(1 0 0 / .1)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "oklch(0.8 0.12 60)" }}>{n}</span>
                <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>{t}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "oklch(0.82 0.02 160)" }}>→ {fix}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="cach-dung" style={{ ...wrap, paddingTop: "clamp(56px,8vw,100px)", paddingBottom: "clamp(56px,8vw,100px)", display: "flex", flexDirection: "column", gap: 28, scrollMarginTop: 80 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
          <span style={eyebrow("oklch(0.5 0.1 158)")}>CÁCH DÙNG · 4 BƯỚC</span>
          <h2 style={h2}>Từ lúc khách đặt tới lúc trả xe.</h2>
        </div>
        <div className="mp-steps">
          {STEPS.map((x, i) => (
            <button
              key={x[0]}
              type="button"
              onClick={() => { setStep(i); setManual(true); setTick(1); }}
              style={{ cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "inherit", display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: 18, background: i === step ? "white" : "transparent", border: `1.5px solid ${i === step ? "oklch(0.85 0.04 158)" : LINE}`, transition: "all .25s" }}
            >
              <div style={{ height: 4, borderRadius: 2, background: "oklch(0.9 0.01 160)", overflow: "hidden", width: "100%" }}>
                <div style={{ height: "100%", width: i < step ? "100%" : i === step ? (auto ? (tick ? "100%" : "0%") : "100%") : "0%", background: O, transition: `width ${i === step && auto ? "6s" : "0s"} linear` }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.55 0.02 160)" }}>BƯỚC {x[0]}</span>
              <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>{x[1]}</span>
            </button>
          ))}
        </div>
        <div className="mp-step" style={{ padding: "clamp(18px,3vw,36px)", borderRadius: 28, background: "white", border: `1px solid ${LINE}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, color: O }}>{st[0]}</span>
            <h3 style={{ margin: 0, fontSize: "clamp(22px,2.6vw,30px)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2 }}>{st[1]}</h3>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "oklch(0.42 0.02 160)" }}>{st[2]}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {st[3].map((x) => (
                <span key={x} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.5 }}>
                  <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", background: "oklch(0.95 0.035 155)", color: "oklch(0.38 0.1 155)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, marginTop: 1 }}>✓</span>{x}
                </span>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 24, background: "oklch(0.965 0.008 160)", padding: "clamp(14px,2.4vw,24px)", minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {step === 0 && (
              <div key="s1" style={{ ...card, width: "100%", maxWidth: 340, overflow: "hidden" }}>
                <div style={{ position: "relative", aspectRatio: "16/11" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={IMG.xanh} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 72%", display: "block" }} />
                  <span style={{ position: "absolute", top: 10, left: 10, fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: "oklch(0.96 0.035 155)", color: "oklch(0.36 0.1 155)" }}>Rảnh</span>
                  <span style={{ position: "absolute", top: 10, right: 10, fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 800, padding: "5px 9px", borderRadius: 8, background: "white", border: "1.5px solid oklch(0.3 0.03 160)" }}>26B2-777.15</span>
                </div>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b style={{ fontSize: 17 }}>Yamaha PG-1</b><b style={{ color: "oklch(0.55 0.16 45)" }}>280k/ngày</b></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Côn tay", "Xanh ngọc", "Đời 2024", "Tình trạng tốt"].map((c) => <span key={c} style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "oklch(0.965 0.006 160)" }}>{c}</span>)}
                  </div>
                  <span style={{ fontSize: 13, color: "oklch(0.45 0.02 160)" }}>Thay nhớt tiếp theo sau 420 km · Bảo hiểm còn 210 ngày</span>
                </div>
              </div>
            )}
            {step === 1 && (
              <div key="s2" style={{ ...card, width: "100%", maxWidth: 380, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 15 }}>Đơn mới · 20 → 22/11</b><span style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.02 160)" }}>2 xe · 3 ngày</span></div>
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.95 0.04 155)", color: "oklch(0.36 0.1 155)", fontSize: 14, fontWeight: 800 }}>Đã tự xếp 2 xe trống phù hợp</div>
                {([["PG-1 Vàng", "Tình trạng tốt · 8.600 km", IMG.vang, "50% 55%", true], ["PG-1 Xanh ngọc", "Tình trạng tốt · 12.480 km", IMG.xanh, "50% 75%", true], ["PG-1 Bạc", "Bận 21–22/11 · Anh Đức", IMG.bac, "30% 70%", false]] as const).map(([name, why, img, pos, on]) => (
                  <div key={name} style={{ display: "grid", gridTemplateColumns: "22px 52px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 14, border: `1.5px solid ${on ? G : LINE}`, background: on ? "oklch(0.97 0.02 155)" : "white", opacity: on ? 1 : 0.5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${on ? G : "oklch(0.8 0.01 160)"}`, background: on ? G : "white", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>{on ? "✓" : ""}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" style={{ width: 52, height: 40, borderRadius: 9, objectFit: "cover", objectPosition: pos }} />
                    <span style={{ minWidth: 0 }}><b style={{ display: "block", fontSize: 14 }}>{name}</b><span style={{ display: "block", fontSize: 12, color: on ? "oklch(0.5 0.02 160)" : "oklch(0.55 0.16 28)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{why}</span></span>
                    <b style={{ fontSize: 13 }}>280k</b>
                  </div>
                ))}
              </div>
            )}
            {step === 2 && (
              <div key="s3" style={{ ...card, width: "100%", maxWidth: 380, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <b style={{ fontSize: 15 }}>Biên bản giao xe · 26B2-777.15</b>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["Số km lúc giao", "12.480 km"], ["Giấy tờ giữ", "CCCD gốc"]].map(([k, v]) => <div key={k} style={{ padding: "9px 11px", borderRadius: 11, background: "oklch(0.975 0.004 160)" }}><div style={{ fontSize: 12, color: "oklch(0.5 0.02 160)" }}>{k}</div><b>{v}</b></div>)}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {fuel.map((n) => <span key={n} style={{ fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 999, background: n === "Đầy" ? "oklch(0.96 0.02 155)" : "white", border: `1.5px solid ${n === "Đầy" ? G : "oklch(0.9 0.01 160)"}` }}>{n}</span>)}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {["2 mũ bảo hiểm", "Áo mưa", "Giá đỡ điện thoại"].map((c) => <span key={c} style={{ fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 999, background: "oklch(0.96 0.02 155)", border: `1.5px solid ${G}` }}>✓ {c}</span>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
                  {([["Trước", IMG.vang, "30% 50%"], ["Sau", IMG.vang, "85% 40%"], ["Trái", IMG.xanh, "30% 78%"], ["Phải", IMG.bac, "50% 72%"]] as const).map(([n, src, pos]) => (
                    <div key={n} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos }} />
                      <span style={{ position: "absolute", left: 4, bottom: 4, fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "oklch(1 0 0 / .9)" }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div key="s4" style={{ ...card, width: "100%", maxWidth: 360, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <b style={{ fontSize: 15 }}>Nhận lại xe &amp; quyết toán</b>
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.975 0.004 160)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "oklch(0.5 0.02 160)" }}>PHÁT SINH TỰ TÍNH</span>
                  {[["Trả muộn 1 giờ", "+30.000đ"], ["Thiếu xăng 1 vạch", "+20.000đ"]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{k}</span><b style={{ color: "oklch(0.55 0.16 45)" }}>{v}</b></div>)}
                </div>
                {[["Tiền thuê 3 ngày", "840.000đ"], ["Phát sinh", "50.000đ"], ["Đã cọc", "−250.000đ"]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "oklch(0.38 0.02 160)", padding: "2px 0" }}><span>{k}</span><span>{v}</span></div>)}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, color: "oklch(0.55 0.16 45)", padding: "2px 0" }}><span>Khách cần trả thêm</span><span>640.000đ</span></div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.48 0.14 50)" }}>Nhớ trả lại CCCD gốc cho khách.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* OVERVIEW MOCK */}
      <section style={{ background: "white", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="mp-ov" style={{ ...wrap, paddingTop: "clamp(56px,8vw,100px)", paddingBottom: "clamp(56px,8vw,100px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={eyebrow("oklch(0.5 0.1 158)")}>LỊCH TỔNG QUAN</span>
            <h2 style={h2}>Cả tháng, cả đội xe, một cái nhìn.</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "oklch(0.42 0.02 160)" }}>Mỗi xe một hàng, mỗi đơn một thanh màu. Khách gọi hỏi “ngày 21 còn xe không?”, nhìn là trả lời được. Bấm ô trống để tạo đơn cho đúng xe đó.</p>
            <div style={{ display: "flex", gap: "6px 14px", flexWrap: "wrap" }}>
              {LEGEND.map(([n, c, bd, bs]) => <span key={n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}><span style={{ width: 16, height: 10, borderRadius: 4, background: c, border: `1.5px ${bs} ${bd}` }} />{n}</span>)}
            </div>
          </div>
          <div style={{ borderRadius: 22, border: `1px solid ${LINE}`, overflow: "hidden", background: "white", boxShadow: "0 30px 60px -36px oklch(0.2 0.05 160 / .45)", minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(86px,120px) repeat(10,minmax(0,1fr))", background: "oklch(0.985 0.004 160)", borderBottom: `1px solid ${LINE}` }}>
              <span style={{ padding: "9px 10px", fontSize: 11, fontWeight: 800, color: "oklch(0.5 0.02 160)" }}>XE</span>
              {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ textAlign: "center", padding: "9px 0", fontSize: 11, fontWeight: 800, color: i === 0 ? "oklch(0.62 0.17 45)" : "oklch(0.5 0.02 160)", background: i === 0 ? "oklch(0.97 0.04 70)" : "transparent" }}>{17 + i}</span>)}
            </div>
            {G_ROWS.map(([name, plate, bars]) => (
              <div key={plate} style={{ display: "grid", gridTemplateColumns: "minmax(86px,120px) minmax(0,1fr)", borderBottom: "1px solid oklch(0.95 0.005 160)" }}>
                <span style={{ padding: "8px 10px", minWidth: 0 }}><b style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b><span style={{ fontFamily: "ui-monospace,monospace", fontSize: 10, color: "oklch(0.5 0.02 160)" }}>{plate}</span></span>
                <div style={{ position: "relative", height: 48, background: "repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), oklch(0.95 0.005 160) calc(10% - 1px) 10%)" }}>
                  {bars.map(([a, n, k, t]) => (
                    <span key={t + a} style={{ position: "absolute", top: 9, bottom: 9, left: a * 10 + 0.6 + "%", width: n * 10 - 1.2 + "%", borderRadius: 8, background: BAR[k][0], color: BAR[k][1], border: `1.5px ${BAR[k][3]} ${BAR[k][2]}`, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", padding: "0 7px", whiteSpace: "nowrap", overflow: "hidden" }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="tinh-nang" style={{ ...wrap, paddingTop: "clamp(56px,8vw,100px)", paddingBottom: "clamp(56px,8vw,100px)", display: "flex", flexDirection: "column", gap: 28, scrollMarginTop: 80 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
          <span style={eyebrow("oklch(0.5 0.1 158)")}>ĐẦY ĐỦ CHO MỘT TIỆM XE</span>
          <h2 style={h2}>Những việc hằng ngày, làm hộ bạn.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,260px),1fr))", gap: 12 }}>
          {FEATS.map(([t, d], i) => (
            <div key={t} style={{ padding: 20, borderRadius: 20, background: "white", border: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "oklch(0.62 0.17 45)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>{t}</span>
              <span style={{ fontSize: 14, lineHeight: 1.55, color: "oklch(0.45 0.02 160)" }}>{d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* DAY */}
      <section style={{ position: "relative", overflow: "hidden", color: "white", background: "oklch(0.2 0.04 165)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.hong} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%", opacity: 0.55 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, oklch(0.16 0.04 165 / .92) 0%, oklch(0.16 0.04 165 / .75) 55%, oklch(0.16 0.04 165 / .35) 100%)" }} />
        <div style={{ ...wrap, position: "relative", paddingTop: "clamp(56px,8vw,100px)", paddingBottom: "clamp(56px,8vw,100px)", display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 600 }}>
            <span style={eyebrow("oklch(0.85 0.1 78)")}>MỘT NGÀY CỦA TIỆM</span>
            <h2 style={h2}>Từ sáng mở cửa tới tối chốt két.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
            {DAY.map(([t, h, d], i) => (
              <div key={t} style={{ display: "grid", gridTemplateColumns: "64px 16px minmax(0,1fr)", gap: 14 }}>
                <b style={{ fontSize: 17, paddingTop: 2 }}>{t}</b>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: "oklch(0.82 0.12 70)", marginTop: 6, flex: "none" }} />
                  <span style={{ flex: 1, width: 2, background: i === DAY.length - 1 ? "transparent" : "oklch(1 0 0 / .25)" }} />
                </span>
                <div style={{ paddingBottom: 22 }}><b style={{ display: "block", fontSize: 16 }}>{h}</b><span style={{ fontSize: 14, lineHeight: 1.55, color: "oklch(0.88 0.02 160)" }}>{d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 860, width: "100%", margin: "0 auto", padding: "clamp(56px,8vw,100px) clamp(16px,4vw,32px)", display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ ...h2, fontSize: "clamp(26px,3.6vw,36px)" }}>Câu hỏi thường gặp</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQ.map(([q, a], i) => (
            <div key={q} style={{ borderRadius: 18, background: "white", border: `1px solid ${LINE}`, overflow: "hidden" }}>
              <button type="button" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? -1 : i)} style={{ cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit", color: "inherit", background: "none", border: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", fontSize: 16, fontWeight: 800 }}>
                <span>{q}</span>
                <span style={{ flex: "none", width: 28, height: 28, borderRadius: "50%", background: "oklch(0.95 0.02 155)", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .25s", transform: faq === i ? "rotate(45deg)" : "none" }}>+</span>
              </button>
              {faq === i && <div style={{ padding: "0 18px 16px", fontSize: 15, lineHeight: 1.6, color: "oklch(0.42 0.02 160)" }}>{a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ ...wrap, paddingBottom: "clamp(48px,7vw,80px)" }}>
        <div className="mp-cta" style={{ borderRadius: 32, overflow: "hidden", background: G, color: "white" }}>
          <div style={{ padding: "clamp(28px,5vw,56px)", display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.03em" }}>Dùng thử cho tiệm của bạn.</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "oklch(0.88 0.02 160)", maxWidth: 440 }}>Gửi tụi mình danh sách xe, tụi mình ngồi cùng bạn cài đặt và hướng dẫn trong một buổi.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
              {([["Tà Xùa Booking", formatPhone(sitePhone)]] as const).map(([name, phone]) => {
                const n = phone.replace(/\D/g, "");
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px 10px 16px", borderRadius: 18, background: "oklch(1 0 0 / .08)", border: "1px solid oklch(1 0 0 / .14)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: 15 }}>{name}</b><span style={{ fontSize: 13, color: "oklch(0.85 0.02 160)" }}>{phone}</span></div>
                    <a href={"tel:" + n} style={{ fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, border: "1px solid oklch(1 0 0 / .3)", color: "white" }}>Gọi</a>
                    <a href={"https://zalo.me/" + n} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: O, color: "white" }}>Zalo</a>
                  </div>
                );
              })}
            </div>
            <a href={DEMO} rel="nofollow" className="mp-btn" style={{ alignSelf: "flex-start", fontSize: 15, fontWeight: 800, padding: "13px 22px", borderRadius: 999, background: "white", color: G }}>Mở bản demo →</a>
          </div>
          <div style={{ minHeight: 320, position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.bac} alt="Xe PG-1 cho thuê tại Tà Xùa" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 55%" }} />
          </div>
        </div>
      </section>
    </div>
  );
}
