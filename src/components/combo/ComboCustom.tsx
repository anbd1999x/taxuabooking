"use client";

import { dmy } from "@/lib/date-format";
import { trackLeadConversion } from "@/lib/ads";
import Link from "@/components/Link";
import Image from "next/image";
import { Children, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ComboBusOption, ComboHomeOption, ComboRoomOption, ComboSearchResult } from "@/lib/combo";
import { ensureSheetFresh } from "@/components/ensureSheet";
import { payingChildren } from "@/lib/occupancy";
import { comboQuote } from "@/lib/combo-pricing";
import { CUSTOM_MAX_PEOPLE, CUSTOM_MAX_ROOMS, CUSTOM_MAX_TICKETS, cheapestPick, groupQty, groupRooms, pickedRooms, toQuoteRoom, type CustomRoomGroup } from "@/lib/combo-custom";
import { ComboModeSlot } from "@/components/combo/ComboModeSwitch";
import { useImageSearch, ImageSearchBar, ImageSearchChip, SimBadge, hitCover } from "@/components/image-search/ImageSearch";
import { HomeDrawer, RoomViewer } from "@/components/combo/ComboCustomViews";
import { NearbyButton } from "@/components/nearby/NearbyPopup";
import { ComboSchedule } from "@/components/combo/ComboSchedule";
import { useComboBike, comboBikePayload, ComboBikePicker, ComboBikeSummary, ComboBikeDoneNote } from "@/components/combo/ComboBike";
import { vnPhoneError } from "@/lib/phone";
import { BookingEmailField, emailLooksValid } from "@/components/BookingEmailField";
import { showGlobalLoading } from "@/components/useSearchNav";
import { CommitmentLink } from "@/components/trust/parts";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * COMBO TỰ CHỌN (thiết kế claude.ai/design "Combo Tu chon"): khách tự chọn homestay → số phòng
 * từng loại (ghép nhiều loại tuỳ ý) → nhà xe + SỐ VÉ khứ hồi. Giá hiện ở đây chỉ để xem trước;
 * server (`createComboBooking`, nhánh `tickets`) tính lại toàn bộ khi gửi đơn.
 */

const MAX_ROOMS = CUSTOM_MAX_ROOMS;
const MAX_TICKETS = CUSTOM_MAX_TICKETS;
const MAX_BILLABLE = CUSTOM_MAX_PEOPLE;

const G = "oklch(0.29 0.055 160)"; // xanh rừng
const O = "oklch(0.68 0.18 45)"; // cam điểm nhấn
const MUTED = "oklch(0.5 0.02 160)";
const LINE = "oklch(0.92 0.01 160)";
/** Dropdown chữ mảnh của thanh lọc (đồng bộ với ComboResults). */

function vnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type Grp = CustomRoomGroup;
/** Hiện HẾT phòng trống: mỗi phòng một dòng riêng (không gộp các phòng giống nhau). */
const listRooms = (h: Pick<ComboHomeOption, "rooms">) => groupRooms(h, true);

function cheapestBus(buses: ComboBusOption[]): ComboBusOption | undefined {
  return [...buses].sort((a, b) => a.farePerPerson - b.farePerPerson)[0];
}

/**
 * Băng trượt ngang theo TRANG: mỗi trang xếp dọc `perPage` mục, vuốt ngang (dừng đúng từng trang) hoặc bấm
 * mũi tên / chấm tròn bên dưới để chuyển trang. `resetKey` đổi ⇒ quay về trang đầu.
 */
function PagedRail({ children, perPage, resetKey }: { children: ReactNode; perPage: number; resetKey: string }) {
  const t = useT();
  const items = Children.toArray(children);
  const pages: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const GAP = 10;
  const go = (i: number, smooth = true) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: Math.max(0, i) * (el.clientWidth + GAP), behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => { go(0, false); }, [resetKey]);
  const many = pages.length > 1;
  const arrow = "flex h-9 w-9 flex-none items-center justify-center rounded-full text-xl font-extrabold transition disabled:opacity-30";
  return (
    <>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          const p = Math.round(el.scrollLeft / (el.clientWidth + GAP));
          if (p !== page) setPage(p);
        }}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((pg, i) => (
          <div key={i} className="flex w-full flex-none snap-start snap-always flex-col gap-2.5">{pg}</div>
        ))}
      </div>
      {many && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" aria-label={t("Trang trước")} onClick={() => go(page - 1)} disabled={page <= 0} className={`${arrow} bg-white`} style={{ border: `1.5px solid ${G}`, color: G }}>‹</button>
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-xs font-bold" style={{ color: MUTED }}>
            <div className="flex items-center gap-1.5">
              {pages.map((_, i) => (
                <button key={i} type="button" aria-label={t("Trang {0}", [i + 1])} onClick={() => go(i)} className="h-2 rounded-full transition-all" style={{ width: i === page ? 18 : 8, background: i === page ? G : "oklch(0.86 0.02 160)" }} />
              ))}
            </div>
            <span>{t("Vuốt ngang để xem thêm · {0}/{1}", [page + 1, pages.length])}</span>
          </div>
          <button type="button" aria-label={t("Trang sau")} onClick={() => go(page + 1)} disabled={page >= pages.length - 1} className={`${arrow} text-white`} style={{ background: G }}>›</button>
        </div>
      )}
    </>
  );
}

export function ComboCustom({
  result,
  suggestHref,
}: {
  result: ComboSearchResult;
  /** Link quay về chế độ "Combo gợi ý" (giữ nguyên ngày / số người). */
  suggestHref: string;
}) {
  const t = useT();
  const { homes, buses, nights, fromKey, toKey, checkIn, checkOut, childrenAges, origin } = result;

  const adults = result.adults; // số khách đổi ở ô tìm kiếm ⇒ trang dựng lại component (key theo số khách)
  const [homeId, setHomeId] = useState(homes[0]?.serviceId ?? "");
  const home = homes.find((h) => h.serviceId === homeId) ?? homes[0];
  const groups = useMemo(() => (home ? listRooms(home) : []), [home]);

  // Tìm theo ảnh (dùng chung với /homestay): chỉ hiện nhà có ảnh giống, giống nhất trước; tự chọn nhà giống nhất.
  const { img, imgOn, dragging, clearImage, pickFile, dropProps, fileInput } = useImageSearch({
    track: "Tìm combo tự chọn theo ảnh",
    onResult: (ok, r) => {
      if (!ok || !r) return;
      const top = [...homes].filter((h) => r.homes[h.slug]).sort((a, b) => r.homes[b.slug].s - r.homes[a.slug].s)[0];
      if (top && !(home && r.homes[home.slug])) pickHome(top);
    },
  });
  // Danh sách homestay theo thứ tự server (nổi bật / ưu tiên); đang tìm theo ảnh ⇒ chỉ nhà giống, xếp theo độ giống.
  const shownHomes = useMemo(
    () => (imgOn && img ? homes.filter((h) => img.homes[h.slug]).sort((a, b) => img.homes[b.slug].s - img.homes[a.slug].s) : homes),
    [homes, img, imgOn],
  );
  // ----- Băng trượt homestay: mỗi trang 2 × 2 thẻ, vuốt ngang / bấm mũi tên để sang trang -----
  const homePages = useMemo(() => {
    const pages: ComboHomeOption[][] = [];
    for (let i = 0; i < shownHomes.length; i += 4) pages.push(shownHomes.slice(i, i + 4));
    return pages;
  }, [shownHomes]);
  const railRef = useRef<HTMLDivElement>(null);
  const [railPage, setRailPage] = useState(0);
  const RAIL_GAP = 10;
  const goRailPage = (i: number, smooth = true) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, i) * (el.clientWidth + RAIL_GAP), behavior: smooth ? "smooth" : "auto" });
  };
  // Đổi nhà đang chọn / đổi bộ lọc ⇒ đưa băng trượt tới trang có nhà đang chọn (không có thì về trang đầu).
  useEffect(() => {
    const idx = shownHomes.findIndex((h) => h.serviceId === homeId);
    goRailPage(idx < 0 ? 0 : Math.floor(idx / 4), false);
  }, [shownHomes, homeId]);

  const billableOf = (h: ComboHomeOption | undefined, a: number) => a + payingChildren(childrenAges, h?.childFreeUnderAge ?? 0);
  const billable = billableOf(home, adults);
  const freeKids = childrenAges.length - (billable - adults);

  // Mặc định KHÔNG chọn sẵn phòng nào — khách tự chọn (nút "Gợi ý rẻ nhất" chọn giúp khi cần).
  const [sel, setSel] = useState<Record<string, number>>({});
  const [busId, setBusId] = useState(() => cheapestBus(buses)?.serviceId ?? "");
  const bus = buses.find((b) => b.serviceId === busId) ?? cheapestBus(buses);
  const [ticketsRaw, setTicketsRaw] = useState<number | null>(null); // null = theo số khách
  const maxTickets = Math.min(MAX_TICKETS, bus?.seatsAvailable ?? 0);
  const tickets = Math.max(0, Math.min(maxTickets, ticketsRaw ?? billable));
  // Cách nằm (như combo gợi ý): nằm ghép = 1 vé/người, nằm riêng (bao buồng) = ×2 giá vé. Tổng luôn = số vé.
  const [soloRaw, setSoloRaw] = useState(0);
  const solo = Math.max(0, Math.min(tickets, soloRaw));
  const shared = tickets - solo;
  // Thuê xe máy kèm — cùng lựa chọn & cách tính với combo gợi ý (dịch vụ tính riêng, không vào bill).
  const bikeOpt = useComboBike({ people: Math.max(1, billable), nights, checkIn, checkOut });

  const [stage, setStage] = useState<"build" | "form" | "done">("build");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false); // khoá tức thời chống bấm đúp ⇒ tạo 2 đơn
  const [code, setCode] = useState("");
  const sumRef = useRef<HTMLElement>(null);
  const roomsRef = useRef<HTMLElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);

  // ----- Phòng đã chọn + TOÀN BỘ tiền: cùng hàm comboQuote với server (createComboBooking) -----
  const qOf = (g: Grp) => groupQty(g, sel);
  const picked = pickedRooms(groups, sel);
  const nRooms = picked.length;
  const extraFee = home?.rooms[0]?.extraFeeStay ?? 0; // phụ thu ở ghép CHUNG của homestay (cả kỳ / khách)
  const fare = bus?.farePerPerson ?? 0;
  const quote = comboQuote({ rooms: picked.map(toQuoteRoom), people: billable, extraFeeStay: extraFee, fare, shared, solo, discountPerGuest: result.comboDiscount });
  const { capacityStd: capStd, capacityMax: capMax, extraGuests, extraCost, busAmount: busTotal, discountPeople: comboPeople, discount: comboKm, total } = quote;
  const communalAll = quote.communal;
  const mixed = quote.error === "MIXED";
  const roomWeb = quote.roomCost;
  const webKm = Math.max(0, quote.roomCostOld - quote.roomCost);
  const listTotal = quote.roomCostOld + busTotal;
  const saved = listTotal - total;
  const short = capStd < billable;

  const problem = !home
    ? t("Chưa có homestay còn phòng trống cho ngày này.")
    : !nRooms
      ? t("Chọn ít nhất 1 phòng để đặt combo.")
      : nRooms > MAX_ROOMS
        ? t("Mỗi đơn tối đa {0} phòng — đoàn đông hơn vui lòng liên hệ để được xếp phòng.", [MAX_ROOMS])
        : mixed
          ? t("Không ghép phòng thường với giường cộng đồng trong cùng một combo.")
          : billable > MAX_BILLABLE
            ? t("Mỗi đơn tối đa {0} khách — đoàn đông hơn vui lòng liên hệ.", [MAX_BILLABLE])
            : capMax < billable
              ? t("Phòng đã chọn mới đủ {0} chỗ, còn thiếu {1} khách. Thêm phòng hoặc giảm số khách.", [capMax, billable - capMax])
              : !bus
                ? t("Chưa có nhà xe mở cả chuyến đi lẫn về cho ngày này.")
                : !tickets
                  ? t("Chọn ít nhất 1 vé xe để thành combo.")
                  : bikeOpt.bikes > 0 && !bikeOpt.bikeTimeOk
                    ? t("Trả xe trong ngày nhận thì giờ trả phải sau giờ nhận xe.")
                    : "";

  // Tổng đổi ⇒ số tiền "nảy" nhẹ (theo thiết kế).
  const lastTotal = useRef(total);
  useEffect(() => {
    const el = totalRef.current;
    if (el && lastTotal.current !== total) {
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "cc-bump .35s ease";
    }
    lastTotal.current = total;
  }, [total]);

  // ----- Xem nhà (ngăn bên phải) / Xem phòng (hộp giữa màn hình) -----
  const [viewHomeId, setViewHomeId] = useState<string | null>(null);
  const [viewRoom, setViewRoom] = useState<{ homeId: string; key: string } | null>(null);
  const viewHome = viewHomeId ? homes.find((h) => h.serviceId === viewHomeId) ?? null : null;
  const viewHomeGroups = useMemo(() => (viewHome ? listRooms(viewHome) : []), [viewHome]);
  const vrHome = viewRoom ? homes.find((h) => h.serviceId === viewRoom.homeId) ?? null : null;
  const vrGroup = useMemo(() => (vrHome && viewRoom ? listRooms(vrHome).find((g) => g.key === viewRoom.key) ?? null : null), [vrHome, viewRoom]);
  /** Chọn nhà khác từ hộp "Xem phòng" và thêm luôn 1 phòng loại đang xem. */
  function chooseHomeWithRoom(h: ComboHomeOption, key: string) {
    setHomeId(h.serviceId);
    setSel({ [key]: 1 }); // chỉ đúng phòng khách vừa xem, không tự thêm phòng khác
    setStage("build");
  }

  function pickHome(h: ComboHomeOption) {
    setHomeId(h.serviceId);
    setSel({}); // đổi home ⇒ bỏ phòng của home cũ, không tự chọn phòng mới
    setStage("build");
  }
  function setQty(g: Grp, q: number) {
    setSel((s) => ({ ...s, [g.key]: Math.max(0, Math.min(g.rooms.length, q)) }));
    if (stage === "done") setStage("build");
  }
  function autoFill() {
    setSel(cheapestPick(groups, billable));
    if (stage === "done") setStage("build");
  }
  async function goForm() {
    if (problem || !home) return;
    setErr("");
    // Làm tươi tình trạng phòng ngay trước khi đặt (server bỏ qua nếu vừa đồng bộ <60s).
    showGlobalLoading(true, t("Đang cập nhật tình trạng phòng mới nhất…"));
    try { await ensureSheetFresh(home.serviceId); } finally { showGlobalLoading(false); }
    setStage("form");
  }
  function goSum() {
    const el = sumRef.current;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
    if (!problem && stage === "build") void goForm();
  }
  async function submit() {
    if (sending || sendLock.current) return;
    if (problem || !bus) { setStage("build"); return; }
    if (name.trim().length < 2) { setErr(t("Vui lòng nhập họ tên.")); return; }
    { const pe = vnPhoneError(phone); if (pe) { setErr(pe); return; } }
    if (!emailLooksValid(email)) { setErr(t("Email không hợp lệ (có thể để trống).")); return; }
    sendLock.current = true;
    setSending(true);
    setErr("");
    try {
      const res = await fetch("/api/combo/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromKey, toKey,
          roomIds: picked.map((r) => r.roomId),
          outboundTripId: bus.outboundTripId,
          returnTripId: bus.returnTripId,
          origin: origin || null,
          people: billable,
          adults,
          childrenAges,
          tickets,
          cabinDouble: shared,
          cabinSingle: solo,
          expectedTotal: total,
          ...comboBikePayload(bikeOpt),
          customerName: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ? t(data.error) : t("Gửi yêu cầu thất bại, vui lòng thử lại."));
      else { trackLeadConversion(); setCode(data.code); setStage("done"); }
    } catch {
      setErr(t("Lỗi kết nối, vui lòng thử lại."));
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  const nightsLabel = t("{0} đêm", [nights]);
  const party = t("{0} người lớn", [adults]) + (childrenAges.length ? ` + ${t("{0} trẻ", [childrenAges.length])}` : "");
  const perUnit = (communal: boolean) =>
    communal ? (nights > 1 ? t("/ người / {0} đêm", [nights]) : t("/ người / đêm")) : nights > 1 ? t("/ phòng / {0} đêm", [nights]) : t("/ phòng / đêm");
  const plain = (r: ComboRoomOption) => (r.roomName.startsWith(`${r.typeName} · `) ? r.roomName.slice(r.typeName.length + 3) : r.roomName);
  const capPct = Math.min(100, Math.round((capStd / Math.max(1, billable)) * 100));
  const capWarn = short;
  const capText = !nRooms
    ? t("Chưa chọn phòng · cần chỗ cho {0} khách", [billable])
    : capMax < billable
      ? t("Đủ {0}/{1} chỗ · thiếu {2}", [capMax, billable, billable - capMax])
      : short
        ? t("{0} chỗ chuẩn · {1} khách ở ghép (phụ thu {2})", [capStd, extraGuests, vnd(extraCost)])
        : t("Đủ chỗ {0}/{0} khách", [billable]) + (capStd > billable ? ` · ${t("dư {0}", [capStd - billable])}` : "") + ` · ${t("{0} phòng", [nRooms])}`;
  const tNote = !bus
    ? ""
    : tickets < billable
      ? tickets
        ? t("{0} khách tự đi xe riêng · khuyến mãi combo tính cho {1} người có vé.", [billable - tickets, tickets])
        : t("Không đặt vé xe thì không được khuyến mãi combo.")
      : tickets > billable
        ? t("Số vé nhiều hơn số khách.")
        : "";
  const ctaBg = problem ? "oklch(0.75 0.01 160)" : "oklch(0.27 0.05 160)";
  const stepDot = "flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white";
  const card = "flex flex-col gap-3.5 rounded-3xl border bg-white p-3.5 sm:p-[22px]";
  const inputCls = "rounded-xl border-[1.5px] border-[oklch(0.88_0.015_160)] px-3.5 py-3 text-[15px] outline-none focus:border-forest-500";
  const roundBtn = "flex h-[38px] w-[38px] items-center justify-center rounded-full text-xl font-extrabold disabled:cursor-not-allowed";

  return (
    <div className={`flex flex-col gap-[18px] text-ink ${stage !== "done" ? "max-[1079px]:pb-[84px]" : ""}`}>
      <style>{`@keyframes cc-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes cc-bump{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}`}</style>

      {/* Tiêu đề (ngày / điểm đón / số khách đổi ở ô tìm kiếm phía trên) */}
      {/* Tiêu đề (trái) + công tắc chế độ (phải, thẳng cột khung bill) — khung bill và khung chọn homestay bắt đầu cùng độ cao. */}
      <div className="grid grid-cols-1 items-end gap-4 min-[1080px]:grid-cols-[minmax(0,1fr)_400px] min-[1080px]:gap-5" style={{ animation: "cc-rise .4s ease both" }}>
        <div className="min-w-0">
          {result.planCount > 0 && (
            <Link href={suggestHref} scroll={false} className="text-sm font-bold text-forest-700 hover:text-sunset-600">
              ← {t("{0} phương án combo gợi ý", [result.planCount])}
            </Link>
          )}
          <h2 className="mt-1.5 text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.1] tracking-[-0.03em]">{t("Tự ghép combo của bạn")}</h2>
          <p className="mt-1.5 max-w-[640px] text-[15px]" style={{ color: "oklch(0.48 0.02 160)", textWrap: "pretty" }}>
            {t("Chọn bao nhiêu phòng cũng được, chọn nhà xe bạn thích. Giá combo và khuyến mãi tự tính lại ngay.")}
          </p>
        </div>
        <div className="flex justify-end">
          <ComboModeSlot className="min-[1080px]:w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* BƯỚC 1 — HOMESTAY */}
          <section className={card} style={{ borderColor: LINE, animation: "cc-rise .4s .05s ease both" }}>
            <div className="flex items-center gap-2.5">
              <span className={stepDot} style={{ background: G }}>1</span>
              <div>
                <div className="text-[19px] font-extrabold">{t("Chọn homestay")}</div>
                <div className="text-[13px]" style={{ color: MUTED }}>{t("Chưa biết home nào? Bấm “Xem home” để xem ảnh, đánh giá, tiện ích")}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ImageSearchChip onClick={pickFile} dropProps={dropProps} dragging={dragging} active={Boolean(img)} />
              {!img && <span className="text-[12.5px]" style={{ color: MUTED }}>{t("Có ảnh phòng / view mình thích? Tìm home có ảnh giống")}</span>}
            </div>
            {fileInput}
            {img && <ImageSearchBar img={img} foundLabel={t("{0} homestay có ảnh giống", [shownHomes.length])} onChange={pickFile} onClear={clearImage} />}
            {shownHomes.length === 0 && (
              <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm font-semibold" style={{ borderColor: LINE, color: MUTED }}>{t("Không có homestay phù hợp")}</div>
            )}
            <div className="relative">
            <div
              ref={railRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const p = Math.round(el.scrollLeft / (el.clientWidth + RAIL_GAP));
                if (p !== railPage) setRailPage(p);
              }}
              className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {homePages.map((page, pi) => (
              <div key={pi} className="grid w-full flex-none snap-start snap-always auto-rows-[280px] grid-cols-2 content-start gap-2.5 sm:auto-rows-[330px]">
              {page.map((h) => {
                const on = h.serviceId === home?.serviceId;
                const from = Math.min(...h.rooms.map((r) => r.roomCost));
                const hit = imgOn && img ? img.homes[h.slug] : undefined;
                const cover = hitCover(hit, h.cover ?? h.rooms.find((r) => r.cover)?.cover ?? null);
                return (
                  <div
                    key={h.serviceId}
                    role="button"
                    tabIndex={0}
                    onClick={() => pickHome(h)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pickHome(h); } }}
                    aria-pressed={on}
                    className="flex cursor-pointer flex-col overflow-hidden rounded-[18px] text-left outline-none transition-colors hover:border-[oklch(0.6_0.08_158)] focus-visible:border-[oklch(0.6_0.08_158)]"
                    style={{ border: `2px solid ${on ? G : LINE}`, background: on ? "oklch(0.97 0.02 155)" : "white" }}
                  >
                    <div className="relative min-h-0 w-full flex-1 basis-0 overflow-hidden bg-[oklch(0.95_0.01_160)]">
                      {cover && <Image src={cover} alt={t(h.title)} fill sizes="260px" className="object-cover" />}
                      {hit && <SimBadge s={hit.s} className="bottom-2 right-2" />}
                      {h.area && <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-white px-[9px] py-1 text-xs font-bold">{t(h.area)}</span>}
                      {on && <span className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: G }}>✓</span>}
                    </div>
                    <div className="flex flex-none flex-col gap-1.5 px-3 pb-3 pt-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="line-clamp-1 min-w-0 text-[15px] font-extrabold leading-snug sm:line-clamp-2 sm:text-base">{t(h.title)}</span>
                        {h.rating != null && h.reviewCount > 0 && (
                          <span className="whitespace-nowrap text-[13px] font-extrabold" style={{ color: "oklch(0.5 0.14 60)" }}>
                            ★ {h.rating.toFixed(1).replace(".", ",")} <span className="font-semibold" style={{ color: MUTED }}>({h.reviewCount})</span>
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[13px]" style={{ color: MUTED }}>
                        {t("{0} phòng trống · từ {1}", [h.rooms.length, vnd(from)])}
                      </div>
                      {h.amenities.length > 0 && (
                        <div className="flex h-[22px] flex-none flex-nowrap gap-[5px] overflow-hidden">
                          {h.amenities.slice(0, 2).map((a) => (
                            <span key={a} className="whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold" style={{ background: "oklch(0.95 0.025 155)", color: "oklch(0.36 0.08 155)" }}>{t(a)}</span>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setViewHomeId(h.serviceId); }}
                        className="rounded-full border-[1.5px] bg-white p-2 text-center text-[13px] font-extrabold transition-colors hover:border-[oklch(0.29_0.055_160)]"
                        style={{ borderColor: "oklch(0.86 0.03 158)", color: "oklch(0.3 0.06 158)" }}
                      >
                        {t("Xem home")}
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
              ))}
            </div>
            {/* Mũi tên 2 bên: báo cho khách biết còn trang để vuốt / bấm */}
            {homePages.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={t("Trang trước")}
                  onClick={() => goRailPage(railPage - 1)}
                  disabled={railPage <= 0}
                  className="absolute left-1 top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xl font-extrabold shadow-[0_6px_16px_-4px_oklch(0.2_0.03_160_/.5)] transition disabled:pointer-events-none disabled:opacity-0 sm:-left-3"
                  style={{ border: `1.5px solid ${G}`, color: G }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label={t("Trang sau")}
                  onClick={() => goRailPage(railPage + 1)}
                  disabled={railPage >= homePages.length - 1}
                  className="absolute right-1 top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-xl font-extrabold text-white shadow-[0_6px_16px_-4px_oklch(0.2_0.03_160_/.5)] transition disabled:pointer-events-none disabled:opacity-0 sm:-right-3"
                  style={{ background: G }}
                >
                  ›
                </button>
              </>
            )}
            </div>
            {homePages.length > 1 && (
              <div className="flex items-center justify-center gap-3 text-xs font-bold" style={{ color: MUTED }}>
                <div className="flex items-center gap-1.5">
                  {homePages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={t("Trang {0}", [i + 1])}
                      onClick={() => goRailPage(i)}
                      className="h-2 rounded-full transition-all"
                      style={{ width: i === railPage ? 18 : 8, background: i === railPage ? G : "oklch(0.86 0.02 160)" }}
                    />
                  ))}
                </div>
                <span>{t("Vuốt ngang để xem thêm · {0}/{1}", [railPage + 1, homePages.length])}</span>
              </div>
            )}
          </section>

          {/* BƯỚC 2 — PHÒNG */}
          {home && (
            <section ref={roomsRef} className={`${card} scroll-mt-24`} style={{ borderColor: LINE, animation: "cc-rise .4s .1s ease both" }}>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={stepDot} style={{ background: G }}>2</span>
                  <div>
                    <div className="text-[19px] font-extrabold">{t("Chọn phòng tại {0}", [t(home.title)])}</div>
                    <div className="text-[13px]" style={{ color: MUTED }}>
                      {t("{0} phòng trống · chọn bao nhiêu phòng tuỳ ý", [groups.length])}{" · "}
                      <Link href={`/homestay/${home.slug}?from=${checkIn}&to=${checkOut}`} target="_blank" className="font-bold text-forest-700 hover:text-sunset-600">{t("Xem homestay")} ↗</Link>
                      {" · "}
                      <NearbyButton homeIds={[home.serviceId, ...homes.map((h) => h.serviceId).filter((x) => x !== home.serviceId)]} context="combo" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-forest-700 hover:text-sunset-600" />
                    </div>
                  </div>
                </div>
                <button type="button" onClick={autoFill} className="whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-extrabold transition hover:bg-[oklch(0.96_0.02_155)]" style={{ borderColor: "oklch(0.85 0.04 158)", color: "oklch(0.35 0.08 158)" }}>
                  {t("Gợi ý rẻ nhất cho {0} người", [billable])}
                </button>
              </div>
              {freeKids > 0 && (
                <div className="text-[13px]" style={{ color: MUTED }}>
                  {t("{0} trẻ dưới {1} tuổi ở cùng miễn phí, không tính vào sức chứa.", [freeKids, home.childFreeUnderAge])}
                </div>
              )}
              <div className="flex items-center gap-3 rounded-[14px] px-3.5 py-2.5" style={{ background: capWarn ? "oklch(0.97 0.04 70)" : "oklch(0.96 0.03 155)" }}>
                <div className="h-2 flex-1 overflow-hidden rounded bg-white/80">
                  <div className="h-full transition-[width] duration-300" style={{ width: `${capPct}%`, background: capWarn ? O : "oklch(0.55 0.12 155)" }} />
                </div>
                <span className="text-sm font-extrabold sm:whitespace-nowrap" style={{ color: capWarn ? "oklch(0.5 0.15 45)" : "oklch(0.36 0.09 155)" }}>{capText}</span>
              </div>
              {/* Danh sách phòng: băng trượt ngang, mỗi trang 3 phòng (vuốt / bấm mũi tên để sang trang). */}
              <PagedRail perPage={3} resetKey={home.serviceId}>
                {groups.map((g) => {
                  const q = qOf(g);
                  const on = q > 0;
                  const avail = g.rooms.length;
                  const left = avail - q;
                  const r = g.rep;
                  const img = r.images[0] ?? r.cover;
                  const title = avail === 1 ? r.roomName : r.typeName;
                  const photoCount = g.rooms.reduce((n, x) => n + (x.images.length || (x.cover ? 1 : 0)), 0);
                  const tags = [
                    t("{0} người", [g.cap]),
                    ...(g.capMax > g.cap ? [t("Ở ghép tối đa {0}", [g.capMax])] : []),
                    ...(r.features.cloudView ? [t("View mây")] : []),
                    ...(r.features.hasBathtub ? [t("Bồn tắm")] : []),
                    ...(r.features.breakfast ? [t("Ăn sáng")] : []),
                    ...(r.features.heating ? [t("Đêm sưởi")] : []),
                    ...(r.features.airCon ? [t("Điều hòa")] : []),
                  ];
                  return (
                    <div
                      key={g.key}
                      className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3.5 rounded-[18px] p-2.5 transition-all sm:grid-cols-[120px_minmax(0,1fr)_auto]"
                      style={{ border: `2px solid ${on ? G : LINE}`, background: on ? "oklch(0.975 0.015 155)" : "white" }}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[oklch(0.95_0.01_160)]">
                        {img && <Image src={img} alt={t(title)} fill sizes="120px" className="object-cover" />}
                        <button type="button" onClick={() => setViewRoom({ homeId: home.serviceId, key: g.key })} aria-label={t("Xem phòng")} className="absolute inset-0" />
                        {photoCount > 0 && (
                          <span className="pointer-events-none absolute bottom-1.5 left-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-extrabold text-white" style={{ background: "oklch(0.15 0.02 160 / .7)" }}>{t("{0} ảnh", [photoCount])}</span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="text-[17px] font-extrabold leading-[1.3]">{t(title)}</div>
                        {avail > 1 && (
                          <div className="truncate text-xs" style={{ color: MUTED }}>{g.rooms.map((x) => t(plain(x))).join(", ")}</div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tg) => (
                            <span key={tg} className="whitespace-nowrap rounded-full px-[9px] py-[3px] text-xs font-bold" style={{ background: "oklch(0.95 0.025 155)", color: "oklch(0.36 0.08 155)" }}>{tg}</span>
                          ))}
                          {avail > 1 && (
                            <span className="whitespace-nowrap rounded-full px-[9px] py-[3px] text-xs font-extrabold" style={{ background: "oklch(0.95 0.005 160)", color: "oklch(0.42 0.02 160)" }}>
                              {t("Còn {0} phòng", [avail])}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                          {g.unitOld != null && g.unitOld > g.unit && <span className="text-sm line-through" style={{ color: "oklch(0.55 0.02 160)" }}>{vnd(g.unitOld)}</span>}
                          <span className="text-[19px] font-extrabold" style={{ color: "oklch(0.6 0.18 42)" }}>{vnd(g.unit)}</span>
                          <span className="text-[13px]" style={{ color: MUTED }}>{perUnit(g.communal)}</span>
                        </div>
                        <button type="button" onClick={() => setViewRoom({ homeId: home.serviceId, key: g.key })} className="self-start text-[13px] font-extrabold" style={{ color: "oklch(0.38 0.08 158)" }}>
                          {t("Xem phòng")}
                        </button>
                      </div>
                      {avail === 1 ? (
                        <div className="col-span-full flex flex-col items-stretch gap-1.5 sm:col-auto sm:items-center">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setQty(g, on ? 0 : 1)}
                            className="whitespace-nowrap rounded-full border-2 px-5 py-2.5 text-[15px] font-extrabold transition-colors"
                            style={on ? { background: G, borderColor: G, color: "white" } : { background: "white", borderColor: G, color: G }}
                          >
                            {on ? t("✓ Đã chọn") : t("+ Chọn phòng")}
                          </button>
                          <span className="whitespace-nowrap text-center text-xs font-bold" style={{ color: "oklch(0.45 0.02 160)" }}>
                            {on ? t("Bấm lại để bỏ chọn") : t("{0} chỗ", [g.cap])}
                          </span>
                        </div>
                      ) : (
                      <div className="col-span-full flex flex-col items-center gap-1.5 sm:col-auto">
                        <div className="flex items-center gap-1 rounded-full p-1" style={{ background: on ? "oklch(0.93 0.03 155)" : "oklch(0.95 0.005 160)" }}>
                          <button type="button" aria-label={t("Bớt phòng")} onClick={() => setQty(g, q - 1)} disabled={!q} className={`${roundBtn} bg-white disabled:opacity-35`}>−</button>
                          <span className="min-w-[34px] text-center text-[19px] font-extrabold" style={{ color: on ? G : "oklch(0.6 0.01 160)" }}>{q}</span>
                          <button type="button" aria-label={t("Thêm phòng")} onClick={() => setQty(g, q + 1)} disabled={left <= 0} className={`${roundBtn} text-white disabled:opacity-35`} style={{ background: left > 0 ? G : "oklch(0.85 0.005 160)" }}>+</button>
                        </div>
                        <span className="whitespace-nowrap text-xs font-bold" style={{ color: "oklch(0.45 0.02 160)" }}>
                          {on
                            ? g.communal
                              ? t("{0} phòng · {1} chỗ", [q, q * g.cap])
                              : t("{0} phòng · {1} chỗ · {2}", [q, q * g.cap, vnd(q * g.unit)])
                            : left > 0 ? t("Bấm + để thêm") : t("Hết phòng")}
                        </span>
                      </div>
                      )}
                    </div>
                  );
                })}
              </PagedRail>
            </section>
          )}

          {/* BƯỚC 3 — XE CABIN */}
          <section className={card} style={{ borderColor: LINE, animation: "cc-rise .4s .15s ease both" }}>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className={stepDot} style={{ background: G }}>3</span>
                <div>
                  <div className="text-[19px] font-extrabold">{t("Chọn xe cabin khứ hồi")}</div>
                  <div className="text-[13px]" style={{ color: MUTED }}>
                    {origin ? `${t("Đón tại {0}", [t(origin)])} · ` : ""}{t("đi tối {0}, về {1}", [dmy(fromKey), dmy(toKey)])}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-full py-1.5 pl-3.5 pr-1.5" style={{ background: "oklch(0.965 0.01 160)" }}>
                <span className="whitespace-nowrap text-sm font-bold">{t("Số vé")}</span>
                <button type="button" aria-label={t("Bớt vé")} onClick={() => setTicketsRaw(Math.max(0, tickets - 1))} disabled={!tickets} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white text-lg font-extrabold disabled:opacity-40">−</button>
                <span className="min-w-6 text-center text-lg font-extrabold">{tickets}</span>
                <button type="button" aria-label={t("Thêm vé")} onClick={() => setTicketsRaw(Math.min(maxTickets, tickets + 1))} disabled={tickets >= maxTickets} className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-lg font-extrabold text-white disabled:opacity-40" style={{ background: G }}>+</button>
              </div>
            </div>
            {tNote && <div className="rounded-xl px-3 py-2 text-[13px] font-semibold leading-normal" style={{ background: "oklch(0.97 0.03 80)", color: "oklch(0.45 0.1 55)" }}>{tNote}</div>}
            {bus && tickets > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5" style={{ background: "oklch(0.975 0.008 160)" }}>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold">{t("Cabin đơn · nằm riêng")}</div>
                  <div className="text-xs" style={{ color: MUTED }}>
                    {t("Bao trọn 1 buồng · ×2 giá vé")} · <b className="text-forest-700">{t("{0}/người", [vnd(2 * fare)])}</b>
                    {" · "}{t("còn lại {0} khách nằm ghép ({1}/người)", [shared, vnd(fare)])}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2.5">
                  <button type="button" aria-label={t("Bớt khách nằm riêng")} onClick={() => setSoloRaw(Math.max(0, solo - 1))} disabled={solo <= 0} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-extrabold disabled:opacity-40">−</button>
                  <span className="w-5 text-center text-base font-extrabold">{solo}</span>
                  <button type="button" aria-label={t("Thêm khách nằm riêng")} onClick={() => setSoloRaw(Math.min(tickets, solo + 1))} disabled={solo >= tickets} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-extrabold disabled:opacity-40">+</button>
                </div>
              </div>
            )}
            {buses.length === 0 ? (
              <div className="rounded-xl border-[1.5px] border-dashed px-3 py-4 text-sm" style={{ borderColor: "oklch(0.86 0.02 160)", color: MUTED }}>
                {origin ? t("Chưa có nhà xe nhận đón tại {0} (mở cả chuyến đi lẫn về) cho ngày này.", [t(origin)]) : t("Chưa có nhà xe mở cả chuyến đi lẫn về cho ngày này.")}
              </div>
            ) : (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,260px),1fr))" }}>
                {buses.map((b) => {
                  const on = b.serviceId === bus?.serviceId;
                  const full = b.seatsAvailable <= 0;
                  const few = !full && b.seatsAvailable < tickets;
                  return (
                    <button
                      key={b.serviceId}
                      type="button"
                      disabled={full}
                      aria-pressed={on}
                      onClick={() => { setBusId(b.serviceId); if (stage === "done") setStage("build"); }}
                      className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ border: `2px solid ${on ? "oklch(0.55 0.1 155)" : LINE}`, background: on ? "oklch(0.97 0.02 155)" : "white" }}
                    >
                      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full" style={{ border: `2px solid ${on ? "oklch(0.22 0.03 160)" : "oklch(0.75 0.01 160)"}` }}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? "oklch(0.22 0.03 160)" : "transparent" }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-extrabold">{t(b.title)}</span>
                        <span className="block text-[13px]" style={{ color: MUTED }}>{t("Đi {0} · Về {1}", [b.outboundTime, b.returnTime])}</span>
                      </span>
                      <span className="text-right">
                        <span className="block whitespace-nowrap text-base font-extrabold">{vnd(b.farePerPerson)}</span>
                        <span className="block whitespace-nowrap text-xs font-extrabold" style={{ color: full || few ? "oklch(0.55 0.16 40)" : "oklch(0.45 0.11 155)" }}>
                          {full ? t("Hết chỗ") : few ? t("Chỉ còn {0} chỗ", [b.seatsAvailable]) : b.seatsAvailable >= 30 ? t("Còn chỗ") : t("Còn {0} chỗ", [b.seatsAvailable])}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Tuỳ chọn thêm: thuê xe máy — cùng khối với combo gợi ý */}
          <section className="rounded-3xl bg-white" style={{ animation: "cc-rise .4s .2s ease both" }}>
            <ComboBikePicker state={bikeOpt} />
          </section>
        </div>

        {/* TÓM TẮT + ĐẶT */}
        <aside ref={sumRef} className="flex scroll-mt-20 flex-col gap-3 min-[1080px]:sticky min-[1080px]:top-[84px]" style={{ animation: "cc-rise .4s .1s ease both" }}>
          <div className="overflow-hidden rounded-3xl bg-white" style={{ border: `2px solid ${O}` }}>
            <div className="px-[18px] py-2.5 text-[15px] font-extrabold text-white" style={{ background: O }}>
              {t("Combo của bạn")} · {party} · {nightsLabel}
            </div>
            <div className="flex flex-col gap-3 px-[18px] py-4">
              {nRooms > 0 && home ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-extrabold uppercase tracking-[.08em]" style={{ color: "oklch(0.5 0.08 158)" }}>{t(home.title)}</div>
                  {groups.filter((g) => qOf(g) > 0).map((g) => (
                    <div key={g.key} className="flex justify-between gap-2.5 text-[15px]">
                      <span><b>{qOf(g)}×</b> {t(g.rooms.length === 1 ? g.rep.roomName : g.rep.typeName)}</span>
                      {!g.communal && <b className="whitespace-nowrap">{vnd(qOf(g) * g.unit)}</b>}
                    </div>
                  ))}
                  {communalAll && (
                    <div className="flex justify-between gap-2.5 text-[15px]">
                      <span>{t("{0} giường cộng đồng", [billable])}</span>
                      <b className="whitespace-nowrap">{vnd(roomWeb)}</b>
                    </div>
                  )}
                  {extraGuests > 0 && (
                    <div className="flex justify-between gap-2.5 text-[15px]">
                      <span>{t("Phụ thu {0} khách ở ghép", [extraGuests])}</span>
                      <b className="whitespace-nowrap">{vnd(extraCost)}</b>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border-[1.5px] border-dashed px-3 py-2.5 text-sm" style={{ borderColor: "oklch(0.86 0.02 160)", color: MUTED }}>{t("Chưa chọn phòng nào")}</div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-extrabold tracking-[.08em]" style={{ color: "oklch(0.5 0.08 158)" }}>{t("XE CABIN KHỨ HỒI")}</div>
                <div className="flex justify-between gap-2.5 text-[15px]">
                  <span><b>{tickets}×</b> {bus ? t("vé {0}", [t(bus.title).replace(/^Nhà [xX]e /, "")]) : t("vé xe")}</span>
                  <b className="whitespace-nowrap">{vnd(busTotal)}</b>
                </div>
                {solo > 0 && (
                  <div className="text-xs" style={{ color: MUTED }}>
                    {t("{0} khách nằm ghép × {1} + {2} khách nằm riêng × {3}", [shared, vnd(fare), solo, vnd(2 * fare)])}
                  </div>
                )}
              </div>
              {/* Lịch trình đầy đủ: lên xe · nhận phòng · trả phòng · xe về */}
              <div className="flex flex-col gap-1.5 border-t border-dashed pt-2.5" style={{ borderColor: "oklch(0.86 0.01 160)" }}>
                <div className="text-xs font-extrabold tracking-[.08em]" style={{ color: "oklch(0.5 0.08 158)" }}>{t("LỊCH TRÌNH")}</div>
                <ComboSchedule className="text-sm" fromKey={fromKey} toKey={toKey} checkIn={checkIn} checkOut={checkOut} nights={nights} outTime={bus?.outboundTime ?? null} retTime={bus?.returnTime ?? null} origin={origin} />
              </div>
              {(webKm > 0 || comboKm > 0) && (
                <div className="flex flex-col gap-1.5 border-t border-dashed pt-2.5 text-sm" style={{ borderColor: "oklch(0.86 0.01 160)" }}>
                  <div className="flex justify-between gap-2.5">
                    <span style={{ color: MUTED }}>{t("Tổng theo giá niêm yết")}</span>
                    <span className="whitespace-nowrap line-through" style={{ color: MUTED }}>{vnd(listTotal)}</span>
                  </div>
                  {webKm > 0 && (
                    <div className="flex justify-between gap-2.5 font-extrabold" style={{ color: "oklch(0.52 0.15 45)" }}>
                      <span>{t("Khuyến mãi khi đặt trên website")}</span>
                      <span className="whitespace-nowrap">− {vnd(webKm)}</span>
                    </div>
                  )}
                  {comboKm > 0 && (
                    <div className="flex justify-between gap-2.5 font-extrabold" style={{ color: "oklch(0.52 0.15 45)" }}>
                      <span>{t("Khuyến mãi combo ({0} × {1} người)", [vnd(result.comboDiscount), comboPeople])}</span>
                      <span className="whitespace-nowrap">− {vnd(comboKm)}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end justify-between gap-2.5 border-t pt-3" style={{ borderColor: LINE }}>
                <div>
                  <div className="text-[13px]" style={{ color: MUTED }}>{t("Tổng combo")}</div>
                  <div ref={totalRef} className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em]" style={{ color: "oklch(0.6 0.19 40)" }}>{vnd(total)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px]" style={{ color: MUTED }}>{t("≈ mỗi khách")}</div>
                  <div className="whitespace-nowrap text-[17px] font-extrabold">{vnd(Math.round(total / Math.max(1, billable) / 500) * 500)}</div>
                </div>
              </div>
              {saved > 0 && (
                <div className="rounded-full px-3 py-[7px] text-center text-[13px] font-extrabold" style={{ background: "oklch(0.95 0.05 155)", color: "oklch(0.38 0.1 155)" }}>
                  {t("Tiết kiệm {0} so với giá niêm yết", [vnd(saved)])}
                </div>
              )}

              <ComboBikeSummary state={bikeOpt} />

              {problem && <div className="rounded-xl px-3 py-[9px] text-[13px] font-bold leading-normal" style={{ background: "oklch(0.96 0.03 28)", color: "oklch(0.5 0.16 28)" }}>{problem}</div>}

              {stage === "build" && (
                <button type="button" onClick={goForm} disabled={!!problem} className="rounded-full p-[15px] text-center text-[17px] font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:hover:brightness-100" style={{ background: ctaBg }}>
                  {t("Đặt combo này →")}
                </button>
              )}
              {stage === "form" && (
                <div className="flex flex-col gap-2" style={{ animation: "cc-rise .25s ease both" }}>
                  <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder={t("Họ và tên *")} className={inputCls} />
                  <input value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }} inputMode="tel" placeholder={t("Số điện thoại / Zalo *")} className={inputCls} />
                  <BookingEmailField value={email} onChange={setEmail} inputClassName={inputCls} />
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú (giờ đón, trẻ nhỏ…)")} className={inputCls} />
                  {err && <div className="text-[13px] font-bold" style={{ color: "oklch(0.55 0.19 28)" }}>{t(err)}</div>}
                  <button type="button" onClick={submit} disabled={sending} className="rounded-full p-[15px] text-center text-[17px] font-extrabold text-white disabled:opacity-70" style={{ background: O }}>
                    {sending ? t("Đang gửi…") : t("Gửi yêu cầu đặt combo")}
                  </button>
                  <button type="button" onClick={() => setStage("build")} className="text-center text-sm font-bold text-forest-700">← {t("Sửa lại combo")}</button>
                </div>
              )}
              {stage === "done" && (
                <div className="flex flex-col items-center gap-2 py-2 text-center" style={{ animation: "cc-rise .3s ease both" }}>
                  <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[26px] font-extrabold text-white" style={{ background: "oklch(0.56 0.12 155)" }}>✓</div>
                  <div className="text-[19px] font-extrabold">{t("Đã gửi yêu cầu!")}</div>
                  <div className="rounded-[10px] px-3.5 py-1 font-mono text-2xl font-extrabold tracking-[.06em]" style={{ background: "oklch(0.96 0.02 155)" }}>{code}</div>
                  <div className="text-sm leading-normal" style={{ color: "oklch(0.42 0.02 160)" }}>{t("Tụi mình gọi lại xác nhận phòng, xe và chốt bill qua Zalo.")}</div>
                  <ComboBikeDoneNote state={bikeOpt} />
                  <button type="button" onClick={() => { setStage("build"); setName(""); setPhone(""); setEmail(""); setNote(""); }} className="text-sm font-bold text-forest-700">{t("Ghép combo khác")}</button>
                </div>
              )}
              <CommitmentLink className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900" />
              <div className="text-center text-xs leading-normal" style={{ color: MUTED }}>{t("Chưa cần thanh toán. Giá chính thức là giá chốt bill qua Zalo.")}</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Xem nhà */}
      {viewHome && (
        <HomeDrawer
          home={viewHome}
          groups={viewHomeGroups}
          nights={nights}
          checkIn={checkIn}
          checkOut={checkOut}
          selected={viewHome.serviceId === home?.serviceId}
          onClose={() => setViewHomeId(null)}
          onChoose={() => {
            if (viewHome.serviceId !== home?.serviceId) pickHome(viewHome);
            setViewHomeId(null);
            requestAnimationFrame(() => roomsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
          onViewRoom={(g) => setViewRoom({ homeId: viewHome.serviceId, key: g.key })}
        />
      )}
      {/* Xem phòng (mở đè lên ngăn "Xem nhà" nếu đang mở) */}
      {vrHome && vrGroup && (
        <RoomViewer
          key={vrGroup.key}
          home={vrHome}
          group={vrGroup}
          nights={nights}
          inCombo={vrHome.serviceId === home?.serviceId}
          qty={vrHome.serviceId === home?.serviceId ? qOf(vrGroup) : 0}
          onQty={(q) => setQty(vrGroup, q)}
          onChooseHome={() => { chooseHomeWithRoom(vrHome, vrGroup.key); setViewRoom(null); setViewHomeId(null); }}
          onClose={() => setViewRoom(null)}
        />
      )}

      {/* Thanh đặt nhanh trên mobile */}
      {stage !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-white px-4 pt-2.5 shadow-[0_-10px_30px_-16px_oklch(0.2_0.04_160_/.35)] min-[1080px]:hidden" style={{ borderColor: LINE, paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold" style={{ color: MUTED }}>{t("{0} phòng · {1} vé xe · {2} khách", [nRooms, tickets, billable])}</div>
            <div className="text-[21px] font-extrabold leading-[1.1]" style={{ color: "oklch(0.6 0.19 40)" }}>{vnd(total)}</div>
          </div>
          <button type="button" onClick={goSum} className="whitespace-nowrap rounded-full px-[18px] py-[13px] text-[15px] font-extrabold text-white" style={{ background: ctaBg }}>{t("Đặt combo →")}</button>
        </div>
      )}
    </div>
  );
}
