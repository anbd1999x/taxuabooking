import { SITE } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import type { BookingFacts } from "@/lib/booking-messages";

/**
 * Mẫu HTML của email gửi khách (file thuần, không đụng DB):
 *  - "received": đã nhận yêu cầu, đang chờ xác nhận (điểm nhấn cam).
 *  - "confirmed": đơn đã được xác nhận (điểm nhấn xanh).
 *  - "cancelled": đơn đã bị huỷ — khách/quản trị huỷ hoặc hệ thống tự huỷ (điểm nhấn đỏ, không có thanh tiến trình).
 * Bố cục theo mẫu claude.ai/design (project e7476083-6862-4b85-9b80-6150d019bddf):
 * "Email Da Nhan.html" + "Email Xac Nhan.html". Thư dùng bảng + style nội tuyến + font hệ thống
 * (Arial) để hiển thị đúng trên Gmail / Outlook / di động.
 */
export type BookingEmailKind = "received" | "confirmed" | "cancelled";
export type EmailCompany = { legalName: string; taxCode: string; legalAddress: string; siteUrl: string };

const C = {
  forest: "#1b583d",
  forestDark: "#123a2a",
  ink: "#1a2620",
  body: "#3d4a44",
  mute: "#5f6e66",
  faint: "#8a9891",
  line: "#e4e9e6",
  panel: "#f5f8f6",
  bg: "#eef2ef",
  amber: "#c2410c",
  red: "#b42318",
};
const F = "Arial,Helvetica,sans-serif";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type StepState = "done" | "current" | "todo";

/** Hàng "nhãn — giá trị" trong thẻ dịch vụ; hàng cuối không kẻ chân, hàng tiền in đậm. */
function detailRow(k: string, v: string, last: boolean): string {
  const border = last ? "" : `border-bottom:1px solid ${C.line};`;
  const bold = /^Tiền /.test(k) ? "bold " : "";
  // Cột nhãn rộng theo % (không cố định 200px): trên điện thoại cột giá trị vẫn đủ chỗ, chữ không bị ép/chồng.
  return `<tr><td width="38%" style="width:38%;padding:9px 12px 9px 0;${border}font:14px/20px ${F};color:${C.mute};mso-line-height-rule:exactly;" valign="top">${esc(k)}</td><td align="right" style="padding:9px 0;${border}word-break:break-word;font:${bold}14px/20px ${F};color:${C.ink};mso-line-height-rule:exactly;" valign="top">${esc(v)}</td></tr>`;
}

function serviceCard(s: BookingFacts["sections"][number]): string {
  const rows = s.rows.map(([k, v], i) => detailRow(k, v, i === s.rows.length - 1)).join("");
  return `<tr><td style="padding:10px 40px 0;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:8px;"><tr><td style="padding:16px 20px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top" style="font:bold 16px/22px ${F};color:${C.ink};word-break:break-word;">${esc(s.name)}</td><td align="right" valign="top" style="padding-left:10px;font:bold 11px/22px ${F};letter-spacing:1px;color:${C.forest};white-space:nowrap;">${esc(s.tag.toUpperCase())}</td></tr></table></td></tr><tr><td style="padding:4px 20px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table></td></tr>`;
}

function sectionLabel(text: string): string {
  return `<tr><td style="padding:28px 40px 6px;font:bold 11px/16px ${F};letter-spacing:1.5px;color:${C.mute};text-transform:uppercase;" class="px">${esc(text)}</td></tr>`;
}

function moneyRow(k: string, v: string): string {
  return `<tr><td valign="top" style="padding:9px 12px 9px 0;font:14px/20px ${F};color:${C.mute};">${esc(k)}</td><td align="right" valign="top" style="padding:9px 0;font:14px/20px ${F};color:${C.ink};white-space:nowrap;">${esc(v)}</td></tr>`;
}

function totalRow(k: string, v: string, color: string): string {
  return `<tr><td style="padding:14px 0 4px;border-top:2px solid ${C.ink};font:bold 15px/22px ${F};color:${C.ink};">${esc(k)}</td><td align="right" style="padding:14px 0 4px;border-top:2px solid ${C.ink};font:bold 20px/26px ${F};color:${color};white-space:nowrap;">${esc(v)}</td></tr>`;
}

/** 3 bước tiến trình: done = xanh, current = cam, todo = xám. */
function steps(items: [string, StepState][]): string {
  const cell = ([label, st]: [string, StepState]) => {
    const bar = st === "done" ? C.forest : st === "current" ? C.amber : "#cfd8d3";
    const text = st === "todo" ? `font:12px/16px ${F};color:${C.faint};` : `font:bold 12px/16px ${F};color:${C.ink};`;
    return `<td width="33%" valign="top" style="padding:0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${bar};border-radius:2px;">&nbsp;</td></tr><tr><td style="padding-top:8px;${text}">${esc(label)}</td></tr></table></td>`;
  };
  return `<tr><td style="padding:24px 36px 0;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${items.map(cell).join("")}</tr></table></td></tr>`;
}

function summaryCell(width: string, label: string, value: string, mono = false): string {
  const font = mono ? `bold 20px/26px 'Courier New',Courier,monospace` : `bold 15px/26px ${F}`;
  return `<td class="stack" width="${width}" valign="top" style="padding:16px 20px;"><div style="font:11px/16px ${F};letter-spacing:1px;color:${C.mute};text-transform:uppercase;">${esc(label)}</div><div style="margin-top:4px;font:${font};color:${C.ink};${mono ? "letter-spacing:1px;" : ""}">${esc(value)}</div></td>`;
}

export function renderBookingEmail(
  kind: BookingEmailKind,
  f: BookingFacts,
  co: EmailCompany,
): { subject: string; html: string; text: string } {
  const confirmed = kind === "confirmed";
  const cancelled = kind === "cancelled";
  const paidFull = f.price != null && f.price > 0 && f.collected >= f.price;
  const hasDue = f.due != null && f.due > 0;
  const accent = cancelled ? C.red : confirmed ? C.forest : C.amber;
  const subject = cancelled
    ? `[${f.code}] Đơn đặt chỗ đã được huỷ – ${SITE.name}`
    : confirmed
    ? `[${f.code}] Đơn đặt chỗ đã được xác nhận – ${SITE.name}`
    : `[${f.code}] Đã nhận yêu cầu đặt chỗ – ${SITE.name}`;
  const badge = cancelled ? "ĐÃ HUỶ" : confirmed ? "ĐÃ XÁC NHẬN" : "ĐANG CHỜ XÁC NHẬN";
  const headline = cancelled ? "Đơn đặt chỗ của bạn đã được huỷ" : confirmed ? "Chuyến đi Tà Xùa của bạn đã sẵn sàng" : "Chúng tôi đã nhận yêu cầu đặt chỗ của bạn";
  // Chỉ nói "đã nhận tiền" khi đơn thực sự có ghi nhận thu.
  const paidPhrase = f.collected > 0 ? (paidFull ? " và chúng tôi đã nhận đủ thanh toán" : " và chúng tôi đã nhận tiền cọc") : "";
  const intro = cancelled
    ? `Đơn ${f.code} đã được huỷ${f.cancelReason ? `. Lý do: ${f.cancelReason}` : ""}. Chỗ đã giữ cho đơn này (nếu có) đã được trả lại.`
    : confirmed
    ? `Đối tác đã xác nhận còn chỗ${paidPhrase}. Vui lòng lưu lại email này và mã đơn để đối chiếu khi sử dụng dịch vụ.`
    : `Cảm ơn bạn đã đặt dịch vụ qua ${SITE.name}. Chúng tôi đang kiểm tra chỗ với đối tác và sẽ gọi lại xác nhận trong giờ hoạt động (${SITE.supportHours}).`;
  const preheader = cancelled
    ? `Đơn ${f.code} đã được huỷ${f.cancelReason ? ` — ${f.cancelReason}` : ""}.`
    : confirmed
    ? `Đơn ${f.code} đã được xác nhận. ${f.startLabel} ${f.startDate}.`
    : `Chúng tôi đã nhận yêu cầu ${f.code} và sẽ gọi lại xác nhận chỗ trong giờ hoạt động.`;
  // Kèm mã đơn: trang tra cứu đọc ?q= và hiện luôn kết quả, khách không phải nhập lại.
  const trackUrl = `${co.siteUrl}/tra-cuu?q=${encodeURIComponent(f.code)}`;
  const today = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const hotlineDigits = f.hotline.replace(/\D/g, "");
  const depositPct = f.price && f.collected > 0 && !paidFull ? Math.round((f.collected / f.price) * 100) : null;

  // ----- Khối thanh toán -----
  const sideRows = f.sections.filter((s) => s.amount != null).map((s) => moneyRow(s.tag, formatPrice(s.amount!)));
  const surchargeRows = f.surcharges.map((s) => moneyRow(`Phụ thu ${s.label}`, `+ ${formatPrice(s.amount)}`));
  const priceText = f.price != null ? formatPrice(f.price) : "Đang xác nhận giá";
  const showDeposit = !confirmed && !cancelled && f.deposit != null && hasDue && f.collected < f.deposit;
  const paidLabel = paidFull ? "Đã thanh toán" : depositPct != null ? `Đã thanh toán (cọc ${depositPct}%)` : "Đã thanh toán";
  const money = cancelled
    ? [
        ...surchargeRows,
        moneyRow("Giá trị đơn", priceText),
        moneyRow("Đã thanh toán", f.collected > 0 ? formatPrice(f.collected) : "Chưa thanh toán"),
      ].join("")
    : confirmed
    ? [
        ...surchargeRows,
        moneyRow("Tổng giá trị đơn", priceText),
        moneyRow(paidLabel, f.collected > 0 ? `− ${formatPrice(f.collected)}` : "Chưa thanh toán"),
        ...(f.due != null ? [totalRow("Còn lại", formatPrice(f.due), C.forest)] : []),
      ].join("")
    : [
        ...sideRows,
        ...surchargeRows,
        ...(f.collected > 0 ? [moneyRow("Đã thanh toán", `− ${formatPrice(f.collected)}`)] : []),
        totalRow("Tạm tính", priceText, C.ink),
        ...(showDeposit
          ? [`<tr><td colspan="2" style="padding:0 0 4px;font:12px/18px ${F};color:${C.mute};">Cọc giữ chỗ 50%: <b style="color:${C.ink};">${esc(formatPrice(f.deposit!))}</b> sau khi được xác nhận còn chỗ</td></tr>`]
          : []),
      ].join("");

  // ----- Hộp lưu ý -----
  const notes: string[] = cancelled
    ? [
        f.collected > 0
          ? `Bạn đã thanh toán ${formatPrice(f.collected)} cho đơn này. Nhân viên ${SITE.name} sẽ liên hệ để xử lý khoản tiền theo điều khoản hoàn tiền; bạn cũng có thể gọi/Zalo ${f.hotline}.`
          : "Bạn chưa thanh toán khoản nào cho đơn này nên không phát sinh chi phí.",
        `Nếu đơn bị huỷ nhầm hoặc bạn vẫn muốn đi, hãy đặt lại trên website hoặc gọi/Zalo ${f.hotline} để được giữ chỗ lại (tuỳ tình trạng còn chỗ).`,
      ]
    : confirmed
    ? [
        ...(paidFull
          ? ["Đơn đã được thanh toán đủ."]
          : hasDue
            ? [`Thanh toán ${formatPrice(f.due!)} còn lại khi sử dụng dịch vụ, theo hướng dẫn của nhân viên ${SITE.name}.`]
            : []),
        ...(f.boardNote ? [f.boardNote] : []),
        ...(!paidFull && !hasDue && !f.boardNote ? ["Vui lòng xuất trình mã đơn khi sử dụng dịch vụ."] : []),
      ]
    : [
        `Chỉ chuyển khoản theo thông tin do nhân viên gửi qua Zalo/số điện thoại chính thức ${f.hotline}.`,
        ...(f.autoCancelNote ? [f.autoCancelNote] : []),
        "Giá trên là giá tạm tính; giá có hiệu lực là giá chốt khi xác nhận đơn.",
      ];
  const noteTitle = cancelled ? "Thông tin sau khi huỷ" : confirmed ? (paidFull ? "Thông tin sử dụng dịch vụ" : "Thanh toán phần còn lại") : "Lưu ý quan trọng";
  const noteBg = cancelled ? "#fef3f2" : confirmed ? "#f1f8f4" : "#fdf3ec";
  const noteBorder = cancelled ? "#fecdca" : confirmed ? "#cfe5d8" : "#f6d5bf";
  const noteBox = `<tr><td style="padding:20px 40px 0;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${noteBg}" style="background:${noteBg};border:1px solid ${noteBorder};border-radius:8px;"><tr><td style="padding:16px 20px;">
<div style="font:bold 14px/20px ${F};color:${accent};">${esc(noteTitle)}</div>${notes.map((n) => `<div style="margin-top:6px;font:14px/22px ${F};color:${C.ink};">${esc(n)}</div>`).join("")}</td></tr></table></td></tr>`;

  const stepItems: [string, StepState][] = confirmed
    ? [["Đã nhận yêu cầu", "done"], [f.collected > 0 ? "Đã xác nhận & cọc" : "Đã xác nhận", "done"], ["Sử dụng dịch vụ", "todo"]]
    : [["Đã nhận yêu cầu", "done"], ["Xác nhận & đặt cọc", "todo"], ["Sử dụng dịch vụ", "todo"]];
  const badgeBg = cancelled ? "#fee4e2" : confirmed ? "#e6f2eb" : "#fdeee4";

  const html = `<!doctype html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
a{color:${C.forest};}
@media (max-width:620px){.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:24px!important;line-height:30px!important}.stack{display:block!important;width:100%!important;padding:0 0 12px!important}.btn a{display:block!important}}
</style></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td bgcolor="${C.forest}" style="background:${C.forest};border-radius:12px 12px 0 0;padding:20px 40px;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="34" height="34" align="center" bgcolor="#ffffff" style="width:34px;height:34px;background:#ffffff;border-radius:8px;font:bold 13px/34px ${F};color:${C.forest};letter-spacing:.5px;">TX</td><td style="padding-left:10px;font:bold 17px/22px ${F};color:#ffffff;">${esc(SITE.name)}</td></tr></table></td>
<td align="right" valign="middle" style="font:12px/16px ${F};color:#cfe5d8;">${today}</td></tr></table></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:0;border-top:4px solid ${accent};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:36px 40px 0;" class="px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${badgeBg}" style="background:${badgeBg};border-radius:4px;padding:5px 10px;font:bold 11px/14px ${F};letter-spacing:1.2px;color:${accent};">${badge}</td></tr></table>
<h1 class="h1" style="margin:16px 0 0;font:bold 28px/34px ${F};color:${C.ink};mso-line-height-rule:exactly;">${esc(headline)}</h1>
<p style="margin:14px 0 0;font:15px/24px ${F};color:${C.ink};">Xin chào <b>${esc(f.customerName)}</b>,</p>
<p style="margin:6px 0 0;font:15px/24px ${F};color:${C.body};">${esc(intro)}</p></td></tr>
<tr><td style="padding:24px 40px 0;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="background:${C.panel};border-radius:8px;"><tr>
${summaryCell("40%", "Mã đơn", f.code, true)}
${summaryCell("30%", f.startLabel, f.startDate)}
${summaryCell("30%", f.partyLabel, f.party)}
</tr></table></td></tr>
${cancelled ? "" : steps(stepItems)}
${sectionLabel(`Chi tiết dịch vụ · ${f.categoryLabel}`)}
${f.sections.map(serviceCard).join("\n")}
${f.note ? `<tr><td style="padding:10px 40px 0;font:13px/20px ${F};color:${C.mute};" class="px">Ghi chú của bạn: <span style="color:${C.ink};">${esc(f.note)}</span></td></tr>` : ""}
${f.mapUrl ? `<tr><td style="padding:10px 40px 0;font:13px/20px ${F};" class="px"><a href="${esc(f.mapUrl)}" style="color:${C.forest};font-weight:bold;text-decoration:underline;">Xem vị trí trên bản đồ →</a></td></tr>` : ""}
${sectionLabel("Thanh toán")}
<tr><td style="padding:0 40px;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${money}</table></td></tr>
${notes.length ? noteBox : ""}
<tr><td align="center" style="padding:32px 40px 8px;" class="px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn"><tr><td align="center" bgcolor="${C.forest}" style="background:${C.forest};border-radius:6px;">
<a href="${esc(trackUrl)}" style="display:inline-block;padding:14px 32px;font:bold 15px/20px ${F};color:#ffffff;text-decoration:none;border-radius:6px;">Tra cứu đơn hàng</a></td></tr></table></td></tr>
<tr><td align="center" style="padding:8px 40px 36px;font:13px/20px ${F};color:${C.mute};" class="px">Cần hỗ trợ? Gọi hoặc Zalo <a href="tel:${hotlineDigits}" style="color:${C.ink};font-weight:bold;text-decoration:none;">${esc(f.hotline)}</a> · ${SITE.supportHours} hằng ngày</td></tr>
</table></td></tr>
<tr><td bgcolor="${C.forestDark}" style="background:${C.forestDark};padding:28px 32px 0;font:12px/19px ${F};color:#b9d3c5;" align="center">
<b style="color:#ffffff;font-size:14px;">${esc(SITE.name)}</b> — đại lý trung gian đặt dịch vụ du lịch tại Tà Xùa.<br>Dịch vụ do đối tác (chủ homestay, nhà xe) trực tiếp cung cấp.<br>
${esc(co.legalName)} · MST ${esc(co.taxCode)} · ${esc(co.legalAddress)}<br>
<a href="mailto:${SITE.email}" style="color:#ffffff;">${SITE.email}</a> · <a href="${esc(co.siteUrl)}" style="color:#ffffff;">${esc(co.siteUrl.replace(/^https?:\/\//, ""))}</a></td></tr>
<tr><td bgcolor="${C.forestDark}" style="background:${C.forestDark};border-radius:0 0 12px 12px;padding:16px 32px 28px;font:11px/17px ${F};color:#8fb09f;border-top:1px solid ${C.forestDark};" align="center"><div style="border-top:1px solid #2a5541;padding-top:14px;">Bạn nhận được email này vì đã dùng địa chỉ này khi đặt dịch vụ tại ${esc(SITE.name)}. Nếu không phải bạn, vui lòng bỏ qua hoặc <a href="mailto:${SITE.email}" style="color:#b9d3c5;">báo cho chúng tôi</a>.<br>
<a href="${esc(co.siteUrl)}/cam-ket/dieu-khoan" style="color:#b9d3c5;">Điều khoản &amp; hoàn tiền</a> &nbsp;·&nbsp; <a href="${esc(co.siteUrl)}/chinh-sach-bao-mat" style="color:#b9d3c5;">Chính sách bảo mật</a> &nbsp;·&nbsp; <a href="${esc(co.siteUrl)}/gioi-thieu" style="color:#b9d3c5;">Giới thiệu</a></div></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;

  // Bản văn bản thuần (ứng dụng mail không hiển thị HTML + giảm điểm spam).
  const text = [
    `${headline} – ${SITE.name}`,
    `Mã đơn: ${f.code} · ${f.startLabel}: ${f.startDate} · ${f.partyLabel}: ${f.party}`,
    "",
    `Xin chào ${f.customerName},`,
    intro,
    ...f.sections.flatMap((s) => ["", `${s.tag.toUpperCase()} · ${s.name}`, ...s.rows.map(([k, v]) => `- ${k}: ${v}`)]),
    "",
    ...f.surcharges.map((s) => `Phụ thu ${s.label}: +${formatPrice(s.amount)}`),
    `${cancelled ? "Giá trị đơn" : confirmed ? "Tổng giá trị đơn" : "Tạm tính"}: ${priceText}`,
    ...(confirmed || cancelled || f.collected > 0 ? [`Đã thanh toán: ${f.collected > 0 ? formatPrice(f.collected) : "Chưa thanh toán"}`] : []),
    ...(confirmed && f.due != null ? [`Còn lại: ${formatPrice(f.due)}`] : []),
    ...(showDeposit ? [`Cọc giữ chỗ 50%: ${formatPrice(f.deposit!)} sau khi được xác nhận còn chỗ`] : []),
    "",
    ...notes.map((n) => `• ${n}`),
    "",
    `Tra cứu đơn: ${trackUrl}`,
    `Hỗ trợ: ${f.hotline} (${SITE.supportHours} hằng ngày)`,
    "",
    `${SITE.name} — đại lý trung gian đặt dịch vụ du lịch tại Tà Xùa. Dịch vụ do đối tác trực tiếp cung cấp.`,
    `${co.legalName} · MST ${co.taxCode} · ${co.legalAddress}`,
    `${SITE.email} · ${co.siteUrl}`,
  ].join("\n");

  return { subject, html, text };
}
