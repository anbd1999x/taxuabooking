"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { dmy } from "@/lib/date-format";
import type { ComboHomeOption } from "@/lib/combo";
import type { CustomRoomGroup } from "@/lib/combo-custom";
import { useSitePhone } from "@/components/SiteContact";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * "Xem nhà" (ngăn trượt bên phải) và "Xem phòng" (hộp giữa màn hình) của Combo tự chọn — theo
 * claude.ai/design `Combo Tu chon.dc.html`. Chỉ hiện DỮ LIỆU THẬT: ảnh, mô tả, tiện ích, chính sách,
 * đánh giá đã duyệt (không có thì ẩn mục đó).
 */

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const MUTED = "oklch(0.5 0.02 160)";
const LINE = "oklch(0.92 0.01 160)";

function vnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}
const ratingText = (r: number) => r.toFixed(1).replace(".", ",");

/** Tên gọn của một căn (bỏ tiền tố hạng phòng). */
const plainName = (r: { roomName: string; typeName: string }) =>
  r.roomName.startsWith(`${r.typeName} · `) ? r.roomName.slice(r.typeName.length + 3) : r.roomName;

/** Khoá cuộn nền + đóng bằng phím Esc khi lớp phủ đang mở. */
function useOverlay(onClose: () => void) {
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
}

function CloseBtn({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button type="button" onClick={onClose} aria-label={label} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg font-extrabold" style={{ background: "oklch(0.95 0.005 160)" }}>×</button>
  );
}
const Fact = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="rounded-[14px] px-3 py-2.5" style={{ background: "oklch(0.97 0.008 160)" }}>
    <div className="text-xs font-semibold" style={{ color: MUTED }}>{k}</div>
    <div className="mt-0.5 text-[15px] font-extrabold">{v}</div>
  </div>
);
const Pill = ({ children }: { children: ReactNode }) => (
  <span className="flex-none whitespace-nowrap rounded-full border px-[11px] py-1.5 text-[13px] font-semibold" style={{ borderColor: "oklch(0.9 0.01 160)" }}>{children}</span>
);

interface HomeInfo {
  images: string[];
  summary: string;
  policy: string | null;
  mapUrl: string | null;
  rating: number | null;
  reviewCount: number;
  reviews: { by: string; rating: number; text: string; when: string }[];
}

/* ============================== XEM NHÀ ============================== */

export function HomeDrawer({
  home,
  groups,
  nights,
  checkIn,
  checkOut,
  selected,
  onClose,
  onChoose,
  onViewRoom,
}: {
  home: ComboHomeOption;
  groups: CustomRoomGroup[];
  nights: number;
  checkIn: string;
  checkOut: string;
  /** Nhà này đang được chọn cho combo. */
  selected: boolean;
  onClose: () => void;
  onChoose: () => void;
  onViewRoom: (g: CustomRoomGroup) => void;
}) {
  const t = useT();
  const phone = useSitePhone();
  useOverlay(onClose);
  // Ảnh / chính sách / đánh giá nạp khi mở (không nhồi vào dữ liệu trang).
  const [info, setInfo] = useState<HomeInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/combo/home?id=${encodeURIComponent(home.serviceId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((d: HomeInfo) => { if (alive) setInfo(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [home.serviceId]);

  const roomPics = [...new Set(home.rooms.flatMap((r) => r.images.slice(0, 1)))];
  const pics = info?.images.length ? info.images : [home.cover, ...roomPics].filter((u): u is string => Boolean(u));
  const [main, ...rest] = pics;
  const from = Math.min(...home.rooms.map((r) => r.roomCost));
  const perStay = nights > 1 ? t("/ phòng / {0} đêm", [nights]) : t("/ phòng / đêm");
  const rating = info?.rating ?? home.rating;
  const reviewCount = info?.reviewCount ?? home.reviewCount;
  const facts: [string, ReactNode][] = [
    [t("Khu vực"), home.area ? t(home.area) : "—"],
    ...(home.distanceKm != null ? ([[t("Cách trung tâm"), `${String(home.distanceKm).replace(".", ",")} km`]] as [string, ReactNode][]) : []),
    [t("Giá từ"), `${vnd(from)} ${perStay}`],
    [t("Phòng trống"), t("{0} phòng", [home.rooms.length])],
    ...(home.childFreeUnderAge > 0 ? ([[t("Trẻ em"), t("Miễn phí dưới {0} tuổi", [home.childFreeUnderAge])]] as [string, ReactNode][]) : []),
  ];

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60]" style={{ background: "oklch(0.15 0.03 165 / .5)", backdropFilter: "blur(2px)" }} />
      <aside role="dialog" aria-modal="true" aria-label={t(home.title)} className="fixed bottom-0 right-0 top-0 z-[61] flex w-[min(580px,100%)] flex-col bg-white text-ink shadow-[-30px_0_60px_-30px_oklch(0.1_0.03_160_/.5)]" style={{ animation: "cc-rise .25s ease both" }}>
        <div className="flex items-center justify-between gap-2.5 border-b px-[18px] py-3.5" style={{ borderColor: "oklch(0.93 0.01 160)" }}>
          <div className="min-w-0 truncate text-lg font-extrabold">{t(home.title)}</div>
          <CloseBtn onClose={onClose} label={t("Đóng")} />
        </div>
        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] pb-[22px] pt-4">
          {/* Ảnh: 1 ảnh lớn + 2 ảnh nhỏ */}
          {main && (
            <div className="grid h-60 flex-none gap-1.5 overflow-hidden rounded-[18px]" style={{ gridTemplateColumns: rest.length ? "2fr 1fr" : "1fr", gridTemplateRows: "1fr 1fr" }}>
              <div className="relative row-span-2 bg-[oklch(0.95_0.01_160)]">
                <Image src={main} alt={t(home.title)} fill sizes="400px" className="object-cover" />
                <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-white px-2.5 py-[5px] text-xs font-extrabold">{t("{0} ảnh", [pics.length])}</span>
              </div>
              {rest.slice(0, 2).map((u) => (
                <div key={u} className={`relative bg-[oklch(0.95_0.01_160)] ${rest.length === 1 ? "row-span-2" : ""}`}>
                  <Image src={u} alt="" fill sizes="200px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
          {/* Ảnh còn lại: dải cuộn ngang */}
          {rest.length > 2 && (
            <div className="-mt-2 flex flex-none gap-1.5 overflow-x-auto pb-0.5">
              {rest.slice(2).map((u) => (
                <div key={u} className="relative h-16 w-24 flex-none overflow-hidden rounded-xl bg-[oklch(0.95_0.01_160)]">
                  <Image src={u} alt="" fill sizes="96px" className="object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {rating != null && reviewCount > 0 && (
                <>
                  <span className="font-extrabold" style={{ color: "oklch(0.5 0.14 60)" }}>★ {ratingText(rating)}</span>
                  <span style={{ color: MUTED }}>{t("{0} đánh giá", [reviewCount])}</span>
                  <span style={{ color: MUTED }}>·</span>
                </>
              )}
              <span className="font-bold">
                {home.area ? t(home.area) : ""}{home.distanceKm != null ? ` · ${t("cách trung tâm {0} km", [String(home.distanceKm).replace(".", ",")])}` : ""}
              </span>
            </div>
            {info?.summary && <div className="text-[15px] leading-relaxed" style={{ color: "oklch(0.32 0.02 160)", textWrap: "pretty" }}>{t(info.summary)}</div>}
            {!info && !failed && <div className="h-10 animate-pulse rounded-xl bg-gray-100" />}
          </div>

          <div className="grid grid-cols-2 gap-2">{facts.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</div>

          {home.amenities.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[15px] font-extrabold">{t("Tiện ích")}</div>
              <div className="flex flex-wrap gap-1.5">{home.amenities.map((a) => <Pill key={a}>{t(a)}</Pill>)}</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="text-[15px] font-extrabold">{t("Các phòng {0} → {1}", [dmy(checkIn), dmy(checkOut)])}</div>
            {groups.map((g) => (
              <button key={g.key} type="button" onClick={() => onViewRoom(g)} className="flex items-center justify-between gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition-colors hover:border-[oklch(0.6_0.08_158)]" style={{ borderColor: LINE }}>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold">{t(g.rooms.length === 1 ? g.rep.roomName : g.rep.typeName)}</span>
                  <span className="block text-xs" style={{ color: MUTED }}>
                    {t("{0} người", [g.cap])}{g.rooms.length > 1 ? ` · ${t("Còn {0} phòng", [g.rooms.length])}` : ""} · <b style={{ color: "oklch(0.38 0.08 158)" }}>{t("Xem phòng →")}</b>
                  </span>
                </span>
                <span className="whitespace-nowrap text-right">
                  {g.unitOld != null && g.unitOld > g.unit && <span className="block text-xs line-through" style={{ color: MUTED }}>{vnd(g.unitOld)}</span>}
                  <span className="block text-[15px] font-extrabold" style={{ color: "oklch(0.6 0.18 42)" }}>{vnd(g.unit)}</span>
                </span>
              </button>
            ))}
          </div>

          {info?.policy && (
            <div className="rounded-2xl px-3.5 py-3" style={{ background: "oklch(0.975 0.03 75)" }}>
              <div className="mb-1.5 text-[13px] font-extrabold" style={{ color: "oklch(0.5 0.13 55)" }}>{t("Cần biết trước")}</div>
              <div className="whitespace-pre-line text-sm leading-normal">{t(info.policy)}</div>
            </div>
          )}

          {info && info.reviews.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[15px] font-extrabold">{t("Khách đã ở nói gì")}</div>
              {info.reviews.map((v, i) => (
                <div key={i} className="rounded-2xl px-3.5 py-3" style={{ background: "oklch(0.975 0.006 160)" }}>
                  <div className="flex justify-between gap-2 text-[13px]">
                    <b>{v.by}</b>
                    <span className="font-extrabold" style={{ color: "oklch(0.5 0.14 60)" }}>{"★".repeat(Math.max(1, Math.min(5, v.rating)))}</span>
                  </div>
                  <div className="mt-1 text-sm leading-relaxed" style={{ color: "oklch(0.32 0.02 160)" }}>{v.text}</div>
                  <div className="mt-1 text-xs" style={{ color: MUTED }}>{dmy(v.when)}</div>
                </div>
              ))}
            </div>
          )}

          {info?.mapUrl && (
            <a href={info.mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-[14px] border px-3.5 py-3 text-sm font-bold text-forest-700 hover:text-sunset-600" style={{ borderColor: "oklch(0.9 0.01 160)" }}>
              <span>{t("Xem vị trí trên Google Maps")}</span><span>↗</span>
            </a>
          )}
          <a href={`/homestay/${home.slug}?from=${checkIn}&to=${checkOut}`} target="_blank" rel="noopener" className="-mt-2 text-center text-[13px] font-bold text-forest-700 hover:text-sunset-600">
            {t("Mở trang đầy đủ của homestay")} ↗
          </a>
        </div>
        <div className="flex gap-2 border-t px-[18px] pt-3" style={{ borderColor: "oklch(0.93 0.01 160)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="whitespace-nowrap rounded-full border-[1.5px] px-4 py-[13px] text-[15px] font-extrabold" style={{ borderColor: "oklch(0.88 0.015 160)", color: "oklch(0.25 0.03 160)" }}>{t("Hỏi tụi mình")}</a>
          <button type="button" onClick={onChoose} className="flex-1 rounded-full p-[13px] text-center text-[15px] font-extrabold text-white" style={{ background: selected ? G : O }}>
            {selected ? t("✓ Đang chọn · Chọn phòng ↓") : t("Chọn nhà này cho combo")}
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}

/* ============================== XEM PHÒNG ============================== */

export function RoomViewer({
  home,
  group,
  nights,
  inCombo,
  qty,
  onQty,
  onChooseHome,
  onClose,
}: {
  home: ComboHomeOption;
  group: CustomRoomGroup;
  nights: number;
  /** Nhà của phòng này đang được chọn cho combo ⇒ hiện nút +/− số phòng. */
  inCombo: boolean;
  qty: number;
  onQty: (q: number) => void;
  /** Phòng thuộc nhà KHÁC nhà đang chọn ⇒ nút "Chọn nhà này & thêm phòng". */
  onChooseHome: () => void;
  onClose: () => void;
}) {
  const t = useT();
  useOverlay(onClose);
  // Nhóm có nhiều căn giống nhau ⇒ chuyển căn để xem đúng ảnh / mô tả từng căn.
  const [roomIdx, setRoomIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const room = group.rooms[Math.min(roomIdx, group.rooms.length - 1)];
  const imgs = room.images.length ? room.images : room.cover ? [room.cover] : [];
  const i = imgs.length ? ((imgIdx % imgs.length) + imgs.length) % imgs.length : 0;
  const avail = group.rooms.length;
  const title = avail === 1 ? room.roomName : room.typeName;
  const feats = [
    room.features.cloudView ? t("View mây") : null,
    room.features.hasBathtub ? t("Bồn tắm") : null,
    room.features.breakfast ? t("Ăn sáng") : null,
    room.features.heating ? t("Đêm sưởi") : null,
    room.features.airCon ? t("Điều hòa") : null,
    room.pool ? t("Hồ bơi") : null,
  ].filter((x): x is string => Boolean(x));
  const amen = [...new Set([...feats, ...room.amenityList.map((a) => t(a))])];
  const perUnit = group.communal
    ? nights > 1 ? t("/ người / {0} đêm", [nights]) : t("/ người / đêm")
    : nights > 1 ? t("/ phòng / {0} đêm", [nights]) : t("/ phòng / đêm");
  const note = group.communal
    ? t("Giường cộng đồng: giá tính theo từng người, ở chung phòng với khách khác.")
    : group.capMax > group.cap && room.extraFeeStay > 0
      ? t("Phòng nhận tối đa {0} khách; mỗi khách vượt {1} người phụ thu {2}.", [group.capMax, group.cap, vnd(room.extraFeeStay)])
      : null;

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[70]" style={{ background: "oklch(0.15 0.03 165 / .55)", backdropFilter: "blur(2px)" }} />
      <div role="dialog" aria-modal="true" aria-label={t(title)} className="fixed inset-0 z-[71] m-auto flex h-fit max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] w-[min(760px,96vw)] flex-col overflow-hidden rounded-3xl bg-white text-ink" style={{ animation: "cc-rise .25s ease both" }}>
        <div className="flex items-center justify-between gap-2.5 border-b px-4 py-3" style={{ borderColor: "oklch(0.93 0.01 160)" }}>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold" style={{ color: MUTED }}>{t(home.title)}{home.area ? ` · ${t(home.area)}` : ""}</div>
            <div className="truncate text-lg font-extrabold">{t(title)}</div>
          </div>
          <CloseBtn onClose={onClose} label={t("Đóng")} />
        </div>
        <div className="flex min-h-0 flex-initial flex-col gap-3.5 overflow-y-auto overscroll-contain px-4 pb-[18px] pt-3.5">
          <div className="relative aspect-video flex-none overflow-hidden rounded-[18px] bg-[oklch(0.95_0.01_160)]">
            {imgs.length > 0 ? (
              <Image key={imgs[i]} src={imgs[i]} alt={t(title)} fill sizes="760px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl">🛏️</div>
            )}
            {imgs.length > 1 && (
              <>
                <button type="button" aria-label={t("Ảnh trước")} onClick={() => setImgIdx(i - 1)} className="absolute left-2.5 top-1/2 -mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-extrabold shadow-[0_4px_12px_-4px_oklch(0.2_0.03_160_/.4)]">‹</button>
                <button type="button" aria-label={t("Ảnh sau")} onClick={() => setImgIdx(i + 1)} className="absolute right-2.5 top-1/2 -mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-extrabold shadow-[0_4px_12px_-4px_oklch(0.2_0.03_160_/.4)]">›</button>
                <span className="pointer-events-none absolute bottom-3 right-3 rounded-full px-2.5 py-[5px] text-xs font-extrabold text-white" style={{ background: "oklch(0.15 0.02 160 / .7)" }}>{i + 1} / {imgs.length}</span>
              </>
            )}
          </div>
          {/* Chuyển căn trong nhóm phòng giống nhau */}
          {avail > 1 && (
            <div className="flex flex-none gap-1.5 overflow-x-auto pb-0.5">
              {group.rooms.map((r, j) => {
                const on = j === roomIdx;
                return (
                  <button key={r.roomId} type="button" onClick={() => { setRoomIdx(j); setImgIdx(0); }} className="flex-none whitespace-nowrap rounded-full px-3 py-[7px] text-[13px] font-bold" style={on ? { background: G, color: "white" } : { background: "oklch(0.95 0.008 160)", color: "oklch(0.3 0.03 160)" }}>
                    {t(plainName(r))}
                  </button>
                );
              })}
            </div>
          )}
          {/* Ảnh thu nhỏ của căn đang xem */}
          {imgs.length > 1 && (
            <div className="flex flex-none gap-1.5 overflow-x-auto pb-0.5">
              {imgs.map((u, j) => (
                <button key={u} type="button" onClick={() => setImgIdx(j)} aria-label={t("Ảnh {0}", [j + 1])} className="relative h-14 w-20 flex-none overflow-hidden rounded-xl" style={{ outline: j === i ? `2.5px solid ${G}` : "none", outlineOffset: -2.5 }}>
                  <Image src={u} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
            <Fact k={t("Sức chứa")} v={group.capMax > group.cap ? t("{0} người (tối đa {1})", [group.cap, group.capMax]) : t("{0} người", [group.cap])} />
            <Fact k={t("Hạng phòng")} v={t(room.typeName)} />
            {avail > 1 && <Fact k={t("Còn trống")} v={t("Còn {0} phòng", [avail])} />}
          </div>
          {room.description && <div className="whitespace-pre-line text-[15px] leading-relaxed" style={{ color: "oklch(0.32 0.02 160)", textWrap: "pretty" }}>{t(room.description)}</div>}
          {amen.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[15px] font-extrabold">{t("Trong phòng có")}</div>
              <div className="flex flex-wrap gap-1.5">{amen.map((a) => <Pill key={a}>{a}</Pill>)}</div>
            </div>
          )}
          {note && (
            <div className="rounded-2xl px-3.5 py-3 text-sm leading-normal" style={{ background: "oklch(0.975 0.03 75)", color: "oklch(0.4 0.08 55)" }}>
              <b>{t("Lưu ý:")}</b> {note}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t px-4 pt-3" style={{ borderColor: "oklch(0.93 0.01 160)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <div className="min-w-[140px] flex-1">
            <div className="flex items-baseline gap-2">
              {group.unitOld != null && group.unitOld > group.unit && <span className="text-[13px] line-through" style={{ color: MUTED }}>{vnd(group.unitOld)}</span>}
              <span className="text-[22px] font-extrabold" style={{ color: "oklch(0.6 0.18 42)" }}>{vnd(group.unit)}</span>
            </div>
            <div className="text-xs" style={{ color: MUTED }}>{perUnit}{avail > 1 ? ` · ${t("Còn {0} phòng", [avail])}` : ""}</div>
          </div>
          {inCombo ? (
            <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "oklch(0.93 0.03 155)" }}>
              <button type="button" aria-label={t("Bớt phòng")} onClick={() => onQty(qty - 1)} disabled={qty <= 0} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-extrabold disabled:opacity-35">−</button>
              <span className="min-w-[72px] whitespace-nowrap text-center text-[15px] font-extrabold">{qty > 0 ? t("{0} phòng", [qty]) : t("Chưa chọn")}</span>
              <button type="button" aria-label={t("Thêm phòng")} onClick={() => onQty(qty + 1)} disabled={qty >= avail} className="flex h-10 w-10 items-center justify-center rounded-full text-xl font-extrabold text-white disabled:opacity-35" style={{ background: G }}>+</button>
            </div>
          ) : (
            <button type="button" onClick={onChooseHome} className="whitespace-nowrap rounded-full px-[18px] py-[13px] text-[15px] font-extrabold text-white" style={{ background: O }}>{t("Chọn nhà này & thêm phòng")}</button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
