import { notFound } from "next/navigation";
import QRCode from "qrcode";
import Link from "@/components/Link";
import { getT } from "@/lib/i18n/server";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { orderByToken } from "@/lib/ticket";
import { bankName, foodItems, isSeatItem, vietQrPayload } from "@/lib/ticket-core";
import { wdDmy } from "@/lib/date-format";
import { OrderLive } from "@/components/ticket/OrderLive";
import { DIM, G, KEYFRAMES, LINE, O, money } from "@/components/ticket/tk";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getT())("Vé điện tử"), robots: { index: false, follow: false } };
}

const qrSvg = (text: string, width: number) => QRCode.toString(text, { type: "svg", margin: 1, width, errorCorrectionLevel: "M" });

/**
 * Trang sau khi đặt + vé điện tử của một đơn (mẫu "Ban ve - Khach", màn DONE). Link này cũng là link admin gửi khách qua Zalo.
 * - Đơn chờ thanh toán: hiện VietQR + thông tin chuyển khoản + đếm ngược giữ chỗ; trang tự nạp lại tới khi được xác nhận.
 * - Đã xác nhận: mỗi vé một mã QR (nội dung = token của vé) để nhân viên quét ở /admin/provider/soat-ve.
 */
export default async function TicketOrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Đơn đặt thử từ bản demo (?from=demo): nút quay lại dẫn về màn Trang khách của demo, không ra /ve thật.
  const home = (await searchParams).from === "demo" ? "/demo/dat-ve" : "/ve";
  const { token } = await params;
  const res = await orderByToken(token);
  if (!res) notFound();
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  const phone = settings.contactPhone || SITE.defaultPhone;
  const { order: o, venue, pay } = res;
  const rest = venue.kind === "RESTAURANT";
  const when = `${wdDmy(res.date, t)}${res.time ? " · " + res.time : ""}`;
  const cancelled = o.status === "cancel";
  const confirmed = !cancelled && o.status !== "wait";
  const needPay = !!pay;
  const needPayWas = res.prepay;

  // Vé: đã phát thì lấy vé thật; chưa thì dựng danh sách "sẽ có" từ dòng đơn (mã QR còn mờ).
  type Row = { kind: string; title: string; sub: string; code: string; qr: string; used: string | null; food: boolean };
  let rows: Row[];
  if (confirmed && o.tickets.length) {
    rows = await Promise.all(o.tickets.map(async (k) => ({ kind: k.kind === "food" ? t("VOUCHER ĐỒ ĂN UỐNG") : t("VÉ VÀO CỔNG"), title: k.label, sub: k.kind === "food" ? t("Đưa mã tại quầy để nhận") : when, code: k.code, qr: await qrSvg(k.token, 132), used: k.usedAt, food: k.kind === "food" })));
  } else {
    const blank = await qrSvg(`${SITE.url}/ve`, 132);
    const pre: Omit<Row, "code" | "qr" | "used">[] = [];
    if (rest) pre.push({ kind: t("PHIẾU GIỮ BÀN"), title: `${t("Bàn")} ${res.tables.join(", ") || "—"}`, sub: `${when} · ${t("{0} khách", [o.guests])}`, food: false });
    else {
      for (const label of res.seatLabels) pre.push({ kind: t("VÉ VÀO CỔNG"), title: label, sub: when, food: false });
      for (const i of o.items) if (i.kind === "ticket" && !isSeatItem(i.name)) for (let n = 0; n < i.qty; n++) pre.push({ kind: t("VÉ VÀO CỔNG"), title: `${t(i.name)} #${n + 1}`, sub: `${t(venue.name)} · ${when}`, food: false });
      if (foodItems(o).length) pre.push({ kind: t("VOUCHER ĐỒ ĂN UỐNG"), title: foodItems(o).map((i) => `${i.qty}× ${t(i.name)}`).join(", "), sub: t("Đưa mã tại quầy để nhận"), food: true });
    }
    rows = pre.map((r, i) => ({ ...r, code: `${o.code}-${i + 1}`, qr: blank, used: null }));
  }
  const pending = !confirmed;
  const payQr = pay ? await qrSvg(vietQrPayload({ bin: pay.bin, account: pay.account, amount: pay.amount, memo: o.code }), 150) : "";

  // Đơn chờ có hạn giữ chỗ (đơn web: WEB_CONFIRM_MIN phút kể từ lúc gửi) — quá hạn chưa xác nhận / chưa thu tiền ⇒ tự huỷ.
  const holdNote = o.status === "wait" && o.holdUntil
    ? needPay
      ? t("Chỗ được giữ đến {0}. Quá giờ mà chưa nhận được tiền, đơn tự huỷ và nhả chỗ.", [res.holdUntilHm])
      : t("Chỗ được giữ đến {0}. Quá giờ mà chưa được xác nhận, đơn tự huỷ và nhả chỗ — cần gấp, nhắn Zalo cho tụi mình.", [res.holdUntilHm])
    : "";
  const head = cancelled
    ? res.expired
      ? { icon: "×", bg: "oklch(0.58 0.19 28)", title: t("Đơn đã hết hạn giữ chỗ"), sub: needPayWas ? t("Chưa nhận được thanh toán trong thời gian giữ chỗ nên đơn đã tự huỷ và nhả chỗ. Bạn đặt lại giúp mình nhé.") : t("Đơn chưa được xác nhận trong thời gian giữ chỗ nên đã tự huỷ và nhả chỗ. Bạn đặt lại giúp mình nhé."), st: t("Hết hạn"), stBg: "oklch(0.96 0.03 28)", stFg: "oklch(0.5 0.17 28)" }
      : { icon: "×", bg: "oklch(0.58 0.19 28)", title: t("Đơn đã huỷ"), sub: t("Đơn đã được huỷ. Bạn đặt lại giúp mình nhé."), st: t("Đã huỷ"), stBg: "oklch(0.96 0.03 28)", stFg: "oklch(0.5 0.17 28)" }
    : confirmed
      ? { icon: "✓", bg: "oklch(0.56 0.12 155)", title: rest ? t("Bàn đã được giữ!") : t("Vé đã sẵn sàng!"), sub: rest ? t("Quán đã xác nhận, hẹn gặp bạn đúng giờ") : t("Mỗi người một mã QR, đưa cho nhân viên quét khi vào cổng"), st: t("Đã xác nhận"), stBg: "oklch(0.94 0.05 155)", stFg: "oklch(0.36 0.1 155)" }
      : needPay
        ? { icon: "⏳", bg: O, title: t("Đơn đã tạo, chờ thanh toán"), sub: res.webHoldMin ? t("Chuyển khoản trong {0} phút để giữ chỗ, quá hạn đơn tự huỷ", [res.webHoldMin]) : t("Chuyển khoản trong thời gian giữ chỗ để nhận vé"), st: t("Chờ thanh toán"), stBg: "oklch(0.96 0.05 75)", stFg: "oklch(0.48 0.14 55)" }
        : { icon: "⏳", bg: O, title: t("Đã gửi yêu cầu, chờ xác nhận"), sub: res.webHoldMin && o.holdUntil ? t("Chỗ được giữ {0} phút chờ xác nhận, quá hạn đơn tự huỷ", [res.webHoldMin]) : t("Tụi mình gọi lại xác nhận trong giờ làm việc"), st: t("Chờ xác nhận"), stBg: "oklch(0.96 0.05 75)", stFg: "oklch(0.48 0.14 55)" };
  const steps = cancelled
    ? []
    : needPay
      ? [t("Quét mã VietQR, giữ nguyên nội dung chuyển khoản {0}.", [o.code]), ...(holdNote ? [holdNote] : []), t("Khi nhận tiền, đơn chuyển sang Đã xác nhận và vé QR hiện ngay ở trang này."), rest ? t("Đến quán đúng giờ, báo mã đơn hoặc số điện thoại.") : t("Đến nơi, đưa mã QR cho nhân viên soát vé. Mỗi người một mã.")]
      : confirmed
        ? [rest ? t("Đến quán đúng giờ, báo mã đơn hoặc số điện thoại.") : t("Lưu ảnh vé hoặc mở lại trang này khi đến nơi."), ...(rest ? [] : [t("Mỗi người một mã QR, vào cổng lần lượt.")]), t("Tra cứu lại bất cứ lúc nào bằng mã {0}.", [o.code])]
        : [t("Tụi mình gọi lại xác nhận chỗ và cách thanh toán."), ...(holdNote ? [holdNote] : []), rest ? t("Trạng thái bàn cập nhật ở trang này sau khi quán xác nhận — lưu lại đường link.") : t("Vé QR hiện ở trang này sau khi xác nhận — lưu lại đường link."), t("Tra cứu lại bất cứ lúc nào bằng mã {0}.", [o.code])];
  const card: React.CSSProperties = { background: "white", border: `1px solid ${LINE}`, borderRadius: 24, padding: "clamp(16px,2.4vw,26px)", display: "flex", flexDirection: "column", gap: 14 };

  return (
    <main className="tk-done" style={{ maxWidth: 1180, width: "100%", margin: "0 auto", padding: "26px clamp(16px,3vw,32px) 56px", display: "grid", gap: 18, alignItems: "start", color: "oklch(0.22 0.03 160)" }}>
      <style>{KEYFRAMES + ".tk-done{grid-template-columns:1fr}@media(min-width:960px){.tk-done{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}}.tk-pay{grid-template-columns:1fr}@media(min-width:560px){.tk-pay{grid-template-columns:170px minmax(0,1fr)}}"}</style>
      <section style={{ ...card, animation: "tkRise .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: head.bg, color: "white", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{head.icon}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.01em" }}>{head.title}</div>
            <div style={{ fontSize: 14, color: "oklch(0.48 0.02 160)" }}>{head.sub}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", borderRadius: 16, background: "oklch(0.97 0.012 155)" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: DIM }}>{t("Mã đơn")}</div>
            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 22, fontWeight: 800, letterSpacing: ".05em" }}>{o.code}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, padding: "6px 12px", borderRadius: 999, background: head.stBg, color: head.stFg }}>{head.st}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{t(venue.name)}</div>
          <div style={{ color: "oklch(0.45 0.02 160)" }}>{[when, t(venue.area)].filter(Boolean).join(" · ")}</div>
          {o.items.map((i, n) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ color: "oklch(0.35 0.02 160)" }}>{i.qty}× {t(i.name)}{i.note ? ` — ${i.note}` : ""}</span>
              <b style={{ whiteSpace: "nowrap" }}>{i.price ? money(i.price * i.qty) : t("Miễn phí")}</b>
            </div>
          ))}
          {rest && o.deposit > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ color: "oklch(0.35 0.02 160)" }}>{t("Cọc giữ bàn")}</span><b>{money(o.deposit)}</b></div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, borderTop: "1px dashed oklch(0.86 0.01 160)", paddingTop: 8 }}>
            <span style={{ fontWeight: 700 }}>{rest ? t("Tiền món đặt trước (trả tại quán)") : t("Tổng tiền")}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "oklch(0.6 0.19 40)" }}>{money(o.total)}</span>
          </div>
        </div>

        {pay && (
          <div className="tk-pay" style={{ display: "grid", gap: 16, alignItems: "center", padding: 16, borderRadius: 18, border: `2px solid ${O}` }}>
            <div style={{ padding: 10, borderRadius: 14, background: "white", border: `1px solid ${LINE}`, justifySelf: "center" }}>
              <div style={{ width: 150, height: 150 }} dangerouslySetInnerHTML={{ __html: payQr }} />
              <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, marginTop: 6, color: "oklch(0.45 0.1 250)" }}>VietQR</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{t("Quét mã để chuyển khoản")}</div>
              {([[t("Ngân hàng"), bankName(pay.bin), ""], [t("Số tài khoản"), pay.account, ""], [t("Chủ tài khoản"), pay.holder, ""], [t("Số tiền"), money(pay.amount), "oklch(0.58 0.17 45)"], [t("Nội dung"), o.code, ""]] as const).filter((b) => b[1]).map(([k, val, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ color: DIM }}>{k}</span>
                  <b style={{ textAlign: "right", color: c || undefined, fontFamily: k === t("Nội dung") || k === t("Số tài khoản") ? "ui-monospace,monospace" : undefined }}>{val}</b>
                </div>
              ))}
              <OrderLive holdUntil={o.holdUntil} />
            </div>
          </div>
        )}
        {!pay && o.status === "wait" && <OrderLive holdUntil={o.holdUntil} mode="confirm" />}
        {steps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {steps.map((x, i) => (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.5 }}>
                <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: "oklch(0.95 0.025 155)", color: "oklch(0.38 0.08 158)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={`https://zalo.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", color: "oklch(0.25 0.03 160)" }}>Zalo {phone}</a>
          <Link href={cancelled ? `${home}/${venue.slug}` : home} style={{ fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 999, background: G, color: "white" }}>{cancelled ? t("Đặt lại") : t("Đặt thêm vé khác")}</Link>
        </div>
      </section>

      {!cancelled && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12, animation: "tkRise .4s .1s ease both" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{rest ? t("Phiếu giữ bàn") : t("Vé điện tử · {0} mã QR", [rows.length])}</div>
          {rows.map((r) => (
            <div key={r.code} style={{ display: "grid", gridTemplateColumns: rest ? "1fr" : "minmax(0,1fr) auto", background: "white", borderRadius: 20, border: `1px solid ${LINE}`, overflow: "hidden", opacity: r.used ? 0.6 : 1 }}>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, borderRight: rest ? "none" : "2px dashed oklch(0.9 0.01 160)", minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: r.food ? "oklch(0.5 0.14 55)" : "oklch(0.45 0.1 158)" }}>{r.kind}</div>
                <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>{r.title}</div>
                <div style={{ fontSize: 13, color: "oklch(0.48 0.02 160)" }}>{r.sub}</div>
                {!rest && <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700, color: "oklch(0.45 0.02 160)", marginTop: 4 }}>{r.code}</div>}
                {r.used && <div style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.5 0.14 55)" }}>{t("Đã dùng lúc {0}", [r.used])}</div>}
              </div>
              {!rest && (
                <div style={{ position: "relative", padding: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: pending ? 88 : 132, height: pending ? 88 : 132, opacity: pending ? 0.25 : 1, filter: pending ? "blur(1.5px)" : "none" }} className="tk-qr" dangerouslySetInnerHTML={{ __html: r.qr }} />
                  {pending && <span style={{ position: "absolute", fontSize: 11, fontWeight: 800, padding: "5px 9px", borderRadius: 999, background: "white", border: "1px solid oklch(0.9 0.01 160)", whiteSpace: "nowrap" }}>{head.st}</span>}
                </div>
              )}
            </div>
          ))}
          <style>{".tk-qr svg{width:100%;height:100%;display:block}"}</style>
        </section>
      )}
    </main>
  );
}
