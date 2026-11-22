"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoneyTextInput } from "@/components/admin/MoneyInput";
import { BANKS, MEAL_MIN_DEFAULT, MEAL_MIN_RANGE, REVIEW_LABEL, VENUE_KINDS, WEB_CONFIRM_MIN, type TkMenu, type TkTable, type TkTier, type VenueKind } from "@/lib/ticket-core";
import { showToast } from "@/components/admin/Toast";
import { Act, Badge, Head, MUTED, O, RED, card, inputCls, lbl, type Ctx } from "./ui";

const digits = (s: string) => s.replace(/\D/g, "");
type PlaceRef = { id: string; name: string; kind: string };
const PLACE_KIND: Record<string, string> = { RESTAURANT: "Nhà hàng", CAFE: "Cafe", CHECKIN: "Check-in" };
/** Quán phù hợp với loại địa điểm: nhà hàng ↔ Nhà hàng / Cafe; vé cổng ↔ điểm check-in; show ↔ tất cả. */
const placesFor = (places: PlaceRef[], kind: VenueKind) => places.filter((p) => (kind === "RESTAURANT" ? p.kind !== "CHECKIN" : kind === "GATE" ? p.kind === "CHECKIN" : true));
function PlaceOptions({ places }: { places: PlaceRef[] }) {
  return <>{places.map((p) => <option key={p.id} value={p.id}>{PLACE_KIND[p.kind] ?? p.kind} · {p.name}</option>)}</>;
}
const rowCss: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: "10px 12px", borderRadius: 14, border: "1px solid oklch(0.92 0.01 160)" };
const small: React.CSSProperties = { ...inputCls, fontSize: 14, padding: "8px 10px" };
const chk: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", paddingBottom: 9 };

function Money({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <MoneyTextInput style={small} value={value} placeholder={placeholder} onChange={onChange} />;
}

/** Tab THIẾT LẬP: thông tin địa điểm, hạng vé, thực đơn kèm, bàn; tạo địa điểm mới (admin: duyệt sẵn; đối tác: bản nháp → gửi duyệt). */
export function SetupTab({ ctx, providers, places, onCreated }: { ctx: Ctx | null; providers: { id: string; name: string }[]; places: PlaceRef[]; onCreated: (id: string) => void; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Head title="Thiết lập vé & đặt bàn" note="Địa điểm, hạng vé & giá, đồ ăn uống kèm, bàn và khung giờ" />
      {ctx && <VenueSetup key={`${ctx.data.venue.id}:${ctx.data.venue.review}:${ctx.data.venue.published}`} ctx={ctx} providers={providers} places={places} />}
      <NewVenue providers={providers} places={places} onCreated={onCreated} isAdmin={ctx ? ctx.isAdmin : true} />
    </div>
  );
}

function NewVenue({ providers, places, onCreated, isAdmin }: { providers: { id: string; name: string }[]; places: PlaceRef[]; onCreated: (id: string) => void; isAdmin: boolean }) {
  const [f, setF] = useState({ kind: "GATE" as VenueKind, name: "", ownerId: "", placeId: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div style={{ ...card, border: `2px dashed ${O}` }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>+ Tạo địa điểm bán vé / nhận đặt bàn mới</div>
      {!isAdmin && (
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
          Tạo vé cổng, show hoặc nhà hàng nhận đặt bàn của bạn → thiết lập giá vé / bàn / thực đơn → bấm <b>Gửi duyệt</b>. Quản trị viên Tà Xùa Booking duyệt xong, địa điểm tự hiện ở trang Vé &amp; đặt bàn cho khách.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ ...lbl, flex: "1 1 150px" }}>Loại
          <select style={small} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as VenueKind, placeId: "" })}>
            {(Object.keys(VENUE_KINDS) as VenueKind[]).map((k) => <option key={k} value={k}>{VENUE_KINDS[k]}</option>)}
          </select>
        </label>
        <label style={{ ...lbl, flex: "2 1 220px" }}>Lấy từ quán có sẵn ở danh mục
          <select style={small} value={f.placeId} onChange={(e) => setF({ ...f, placeId: e.target.value, name: places.find((p) => p.id === e.target.value)?.name ?? f.name })}>
            <option value="">— Không, tạo mới —</option>
            <PlaceOptions places={placesFor(places, f.kind)} />
          </select>
        </label>
        <label style={{ ...lbl, flex: "2 1 220px" }}>Tên địa điểm / show<input style={small} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="VD: Mỏm Cá Heo, Đêm nhạc Mây…" /></label>
        {isAdmin && (
          <label style={{ ...lbl, flex: "1 1 170px" }}>Chủ địa điểm
            <select style={small} value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
              <option value="">Sàn tự vận hành</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <Act kind="orange" disabled={busy} onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            const r = await fetch("/api/admin/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "createVenue", ...f }) });
            const j = await r.json();
            if (!r.ok) setErr(j.error ?? "Không tạo được.");
            else onCreated(j.venue.id);
          } finally {
            setBusy(false);
          }
        }}>Tạo</Act>
      </div>
      {err && <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{err}</div>}
    </div>
  );
}

/**
 * Trạng thái duyệt của địa điểm. Đối tác: Gửi duyệt / Rút lại / Gửi lại sau khi sửa. Admin: Duyệt & mở bán / Từ chối (kèm lý do).
 * Địa điểm đã duyệt không hiện khung này (chỉ còn ô "Hiển thị & mở bán").
 */
function ReviewBox({ ctx }: { ctx: Ctx }) {
  const { data, busy, isAdmin } = ctx;
  const router = useRouter();
  const v = data.venue;
  // Sau mỗi thao tác duyệt: làm mới danh sách địa điểm (banner "chờ duyệt", nhãn trong ô chọn địa điểm).
  const call = async (op: string, payload?: Record<string, unknown>) => { if (await ctx.call(op, payload)) router.refresh(); };
  if (v.review === "approved") return null;
  const tone = v.review === "pending" ? ["oklch(0.96 0.05 85)", "oklch(0.45 0.12 70)"] : v.review === "rejected" ? ["oklch(0.95 0.04 28)", "oklch(0.5 0.17 28)"] : ["oklch(0.95 0.008 160)", "oklch(0.4 0.02 160)"];
  const when = v.submittedAt ? new Date(v.submittedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const note =
    v.review === "pending"
      ? isAdmin ? `Đối tác ${v.ownerName || ""} gửi duyệt${when ? " lúc " + when : ""}. Kiểm tra thông tin, giá vé / bàn bên dưới rồi duyệt.` : `Đã gửi duyệt${when ? " lúc " + when : ""}. Quản trị viên duyệt xong địa điểm sẽ tự hiện cho khách đặt.`
      : v.review === "rejected"
        ? `Lý do: ${v.reviewNote || "—"}. ${isAdmin ? "Chờ đối tác sửa và gửi lại." : "Sửa theo góp ý rồi bấm Gửi duyệt lại."}`
        : isAdmin ? "Đối tác đang thiết lập, chưa gửi duyệt." : "Bản nháp — khách chưa thấy. Thêm hạng vé / bàn, giá, ảnh bìa… rồi bấm Gửi duyệt.";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, background: tone[0] }}>
      <Badge big bg="white" fg={tone[1]}>{REVIEW_LABEL[v.review]}</Badge>
      <div style={{ flex: "1 1 240px", fontSize: 13, lineHeight: 1.5, color: "oklch(0.3 0.03 160)" }}>{note}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isAdmin ? (
          <>
            <Act kind="pri" disabled={busy} onClick={() => window.confirm(`Duyệt và mở bán "${v.name}"?`) && call("approveVenue")}>Duyệt &amp; mở bán</Act>
            <Act kind="warn" disabled={busy} onClick={() => { const note = window.prompt("Lý do từ chối (đối tác sẽ thấy để sửa):", v.reviewNote); if (note && note.trim()) void call("rejectVenue", { note: note.trim() }); }}>Từ chối</Act>
          </>
        ) : v.review === "pending" ? (
          <Act disabled={busy} onClick={() => call("withdrawReview")}>Rút lại để sửa</Act>
        ) : (
          <Act kind="orange" disabled={busy} onClick={() => call("submitReview")}>{v.review === "rejected" ? "Gửi duyệt lại" : "Gửi duyệt"}</Act>
        )}
      </div>
    </div>
  );
}

function VenueSetup({ ctx, providers, places }: { ctx: Ctx; providers: { id: string; name: string }[]; places: PlaceRef[] }) {
  const router = useRouter();
  const { data, call, busy, isAdmin } = ctx;
  const v = data.venue;
  const [f, setF] = useState({
    name: v.name, area: v.area, description: v.description, published: v.published, ownerId: v.ownerId ?? "",
    quota: String(v.config.quota), holdMin: String(v.config.holdMin), mealMin: String(v.config.mealMin), slots: v.config.slots.join(", "),
    floors: v.config.floors.map((x) => (x.sub ? `${x.name} | ${x.sub}` : x.name)).join("\n"),
    seatUnit: v.config.seatUnit, placeId: v.placeId ?? "", coverImage: v.coverImage ?? "", hours: v.config.hours, artist: v.config.artist, notes: v.config.notes.join("\n"),
    bankBin: v.config.bankBin, bankAcc: v.config.bankAcc, bankHolder: v.config.bankHolder,
  });
  const [uploading, setUploading] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("venueId", v.id);
      fd.set("file", file);
      const r = await fetch("/api/admin/ticket/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) showToast(j.error ?? "Không tải được ảnh.", "error");
      else setF((x) => ({ ...x, coverImage: j.url }));
    } finally {
      setUploading(false);
    }
  }
  const save = () =>
    call("saveVenue", {
      name: f.name, area: f.area, description: f.description, published: f.published, ...(isAdmin ? { ownerId: f.ownerId } : {}),
      placeId: f.placeId, coverImage: f.coverImage, hours: f.hours, artist: f.artist, notes: f.notes.split("\n").map((s) => s.trim()).filter(Boolean),
      bankBin: f.bankBin, bankAcc: f.bankAcc, bankHolder: f.bankHolder,
      ...(v.kind === "GATE" ? { quota: f.quota } : {}),
      ...(v.kind === "SHOW" ? { holdMin: f.holdMin, seatUnit: f.seatUnit } : {}),
      ...(v.kind === "RESTAURANT"
        ? { mealMin: f.mealMin, slots: f.slots.split(/[,\s]+/).map((s) => s.trim().padStart(5, "0")).filter(Boolean), floors: f.floors.split("\n").map((l) => { const [name, sub] = l.split("|"); return { name: (name ?? "").trim(), sub: (sub ?? "").trim() }; }).filter((x) => x.name) }
        : {}),
    });

  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{VENUE_KINDS[v.kind]} · {v.name}</div>
          {(isAdmin || v.review === "approved") && <label style={{ ...chk, paddingBottom: 0 }}><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} style={{ width: 16, height: 16 }} />Hiển thị & mở bán trên web</label>}
        </div>
        <ReviewBox ctx={ctx} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10 }}>
          <label style={lbl}>Tên<input style={small} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label style={lbl}>Khu vực<input style={small} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Trung tâm, Đỉnh Gió…" /></label>
          {isAdmin && (
            <label style={lbl}>Chủ địa điểm
              <select style={small} value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
                <option value="">Sàn tự vận hành</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          <label style={lbl}>Gắn với quán ở danh mục Nhà hàng / Cafe / Check-in
            <select style={small} value={f.placeId} onChange={(e) => setF({ ...f, placeId: e.target.value })}>
              <option value="">— Không gắn —</option>
              <PlaceOptions places={placesFor(places, v.kind)} />
            </select>
          </label>
          {v.kind === "GATE" && <label style={lbl}>Quota vé mặc định mỗi ngày<input style={small} inputMode="numeric" value={f.quota} onChange={(e) => setF({ ...f, quota: digits(e.target.value) })} /></label>}
          {v.kind === "SHOW" && <label style={lbl}>Giữ ghế đơn quầy / điện thoại chờ thu tiền (phút)<input style={small} inputMode="numeric" value={f.holdMin} onChange={(e) => setF({ ...f, holdMin: digits(e.target.value) })} /></label>}
          {v.kind === "SHOW" && (
            <label style={lbl}>Chỗ ngồi trên sơ đồ bán theo
              <select style={small} value={f.seatUnit} onChange={(e) => setF({ ...f, seatUnit: e.target.value === "table" ? "table" : "seat" })}>
                <option value="seat">Ghế đơn (A1, A2… mỗi ghế một vé)</option>
                <option value="table">Bàn (P-01, S-01… mỗi bàn một vé, 2–4 người)</option>
              </select>
            </label>
          )}
          {v.kind === "RESTAURANT" && <label style={lbl}>Khung giờ nhận bàn (cách nhau dấu phẩy)<input style={small} value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })} placeholder="17:30, 18:00, 18:30" /></label>}
          {v.kind === "RESTAURANT" && <label style={lbl}>Giữ bàn mỗi lượt đặt (phút, {MEAL_MIN_RANGE[0]}–{MEAL_MIN_RANGE[1]})<input style={small} inputMode="numeric" value={f.mealMin} onChange={(e) => setF({ ...f, mealMin: digits(e.target.value) })} placeholder={String(MEAL_MIN_DEFAULT)} /><span style={{ fontWeight: 600 }}>Đặt 18:00, giữ 120 phút ⇒ bàn bận tới 20:00, các khung giờ chồng lên không nhận đặt bàn đó.</span></label>}
        </div>
        {v.kind === "RESTAURANT" && <label style={lbl}>Các tầng — mỗi dòng “Tên tầng | mô tả”<textarea style={{ ...small, minHeight: 76, resize: "vertical" }} value={f.floors} onChange={(e) => setF({ ...f, floors: e.target.value })} placeholder={"Tầng 1 | Sảnh & bếp lửa\nTầng 2 | Ban công view mây"} /></label>}
        <label style={lbl}>Mô tả ngắn cho khách<textarea style={{ ...small, minHeight: 64, resize: "vertical" }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10 }}>
          <label style={lbl}>{v.kind === "SHOW" ? "Ghi chú giờ (VD: mở cửa trước 45 phút)" : "Giờ mở cửa (VD: 05:00 – 18:00)"}<input style={small} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
          {v.kind === "SHOW" && <label style={lbl}>Nghệ sĩ / ban nhạc<input style={small} value={f.artist} onChange={(e) => setF({ ...f, artist: e.target.value })} /></label>}
          <div style={lbl}>Ảnh bìa (hiện ở trang /ve)
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.coverImage && <img src={f.coverImage} alt="" style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 8, flex: "none" }} />}
              <label style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", color: "oklch(0.25 0.03 160)", whiteSpace: "nowrap" }}>
                {uploading ? "Đang tải…" : f.coverImage ? "Đổi ảnh" : "Chọn ảnh"}
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {f.coverImage && <span onClick={() => setF({ ...f, coverImage: "" })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: RED }}>Bỏ ảnh</span>}
            </div>
          </div>
        </div>
        <label style={lbl}>Chính sách đổi / huỷ — mỗi dòng một ý, khách thấy ở trang đặt<textarea style={{ ...small, minHeight: 64, resize: "vertical" }} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={"Vé dùng trong ngày đã chọn, vào cổng 1 lần\nĐổi ngày miễn phí trước 20:00 hôm trước"} /></label>
        {v.kind !== "GATE" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: "oklch(0.975 0.012 155)" }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Tài khoản nhận chuyển khoản (mã VietQR cho khách)</div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
              {v.kind === "SHOW" ? "Có tài khoản: khách đặt xong thấy mã VietQR để chuyển khoản. Để trống: đơn vào danh sách chờ, mình gọi khách xác nhận." : "Chỉ dùng khi chính sách là “Chỉ thu cọc bàn”: khách thấy mã VietQR để chuyển cọc. Để trống: quán gọi khách hướng dẫn chuyển cọc."}
              {` Đơn khách đặt trên web chưa được xác nhận / chưa ghi thu tiền sau ${WEB_CONFIRM_MIN} phút sẽ tự huỷ và nhả ${v.kind === "SHOW" ? "ghế" : "bàn"}.`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 10 }}>
              <label style={lbl}>Ngân hàng
                <select style={small} value={f.bankBin} onChange={(e) => setF({ ...f, bankBin: e.target.value })}>
                  <option value="">— Chưa khai —</option>
                  {BANKS.map(([bin, name]) => <option key={bin} value={bin}>{name}</option>)}
                </select>
              </label>
              <label style={lbl}>Số tài khoản<input style={small} value={f.bankAcc} onChange={(e) => setF({ ...f, bankAcc: e.target.value })} /></label>
              <label style={lbl}>Tên chủ tài khoản (không dấu)<input style={small} value={f.bankHolder} onChange={(e) => setF({ ...f, bankHolder: e.target.value.toUpperCase() })} /></label>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Act kind="pri" disabled={busy} onClick={save}>Lưu thông tin</Act>
          {(isAdmin || v.review !== "approved") && <Act kind="warn" disabled={busy} onClick={async () => { if (window.confirm(`Xoá địa điểm "${v.name}"? (chỉ xoá được khi chưa có đơn)`) && (await call("deleteVenue"))) router.push("/admin/provider/ve?tab=setup"); }}>Xoá địa điểm</Act>}
          <a href={`/ve/${v.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.4 0.08 160)" }}>Trang đặt của khách: /ve/{v.slug} ↗{v.published && v.review === "approved" ? "" : " (chưa mở bán nên khách chưa vào được)"}</a>
        </div>
      </div>

      {v.kind !== "RESTAURANT" && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Hạng vé &amp; giá</div>
          <div style={{ fontSize: 13, color: MUTED }}>{v.kind === "SHOW" ? "Ghế VIP / Thường lấy giá theo hạng ghế trên sơ đồ. Hạng “không số ghế” (khu đứng) bán theo số lượng, có giới hạn mỗi suất." : "Mỗi hạng một giá (0đ = miễn phí). Quota tính chung cho cả ngày."}</div>
          {data.tiers.map((t) => <TierRow key={t.id} ctx={ctx} t={t} />)}
          <TierRow key={"new" + data.tiers.length} ctx={ctx} t={null} />
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{v.kind === "RESTAURANT" ? "Thực đơn đặt trước" : "Đồ ăn uống bán kèm vé"}</div>
        {data.menu.map((m) => <MenuRow key={m.id} ctx={ctx} m={m} />)}
        <MenuRow key={"new" + data.menu.length} ctx={ctx} m={null} />
      </div>

      {v.kind === "RESTAURANT" && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Bàn ({data.tables.length})</div>
          <div style={{ fontSize: 13, color: MUTED }}>Bàn cùng “khu” gom thành một khối trên sơ đồ. “Bàn tròn” chỉ đổi hình vẽ (bàn ≤ 4 chỗ).</div>
          {data.tables.map((t) => <TableRow key={t.id} ctx={ctx} t={t} />)}
          <TableRow key={"new" + data.tables.length} ctx={ctx} t={null} />
        </div>
      )}
    </>
  );
}

function TierRow({ ctx, t }: { ctx: Ctx; t: TkTier | null }) {
  const show = ctx.data.venue.kind === "SHOW";
  const [f, setF] = useState({ name: t?.name ?? "", price: t ? String(t.price) : "", listPrice: t?.listPrice ? String(t.listPrice) : "", seatClass: t?.seatClass ?? "", quota: t?.quota != null ? String(t.quota) : "", active: t?.active ?? true });
  return (
    <div style={{ ...rowCss, background: t ? "white" : "oklch(0.98 0.01 80)" }}>
      <label style={{ ...lbl, flex: "2 1 150px" }}>{t ? "Tên hạng vé" : "Thêm hạng vé"}<input style={small} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Người lớn, VIP, Khu đứng…" /></label>
      <label style={{ ...lbl, flex: "1 1 110px" }}>Giá bán<Money value={f.price} onChange={(price) => setF({ ...f, price })} placeholder="0" /></label>
      <label style={{ ...lbl, flex: "1 1 110px" }}>Giá gạch<Money value={f.listPrice} onChange={(listPrice) => setF({ ...f, listPrice })} placeholder="Không giảm" /></label>
      {show && (
        <>
          <label style={{ ...lbl, flex: "1 1 130px" }}>Loại
            <select style={small} value={f.seatClass} onChange={(e) => setF({ ...f, seatClass: e.target.value as "vip" | "norm" | "" })}>
              <option value="vip">Ghế VIP (sơ đồ)</option>
              <option value="norm">Ghế Thường (sơ đồ)</option>
              <option value="">Không số ghế</option>
            </select>
          </label>
          {!f.seatClass && <label style={{ ...lbl, flex: "1 1 90px" }}>Số vé / suất<input style={small} inputMode="numeric" value={f.quota} onChange={(e) => setF({ ...f, quota: digits(e.target.value) })} placeholder="Không giới hạn" /></label>}
        </>
      )}
      <label style={chk}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Đang bán</label>
      <Act kind="pri" disabled={ctx.busy} onClick={() => ctx.call("saveTier", { tier: { ...f, id: t?.id } })}>{t ? "Lưu" : "Thêm"}</Act>
      {t && <Act kind="warn" disabled={ctx.busy} onClick={() => window.confirm(`Xoá hạng vé "${t.name}"?`) && ctx.call("deleteTier", { id: t.id })}>Xoá</Act>}
    </div>
  );
}

function MenuRow({ ctx, m }: { ctx: Ctx; m: TkMenu | null }) {
  const [f, setF] = useState({ name: m?.name ?? "", group: m?.group ?? "", price: m ? String(m.price) : "", active: m?.active ?? true });
  const [up, setUp] = useState(false);
  /** Tải một hay nhiều ảnh rồi nối vào ảnh của món (tối đa 8). */
  async function addImages(files: FileList | null) {
    if (!m) return;
    const list = [...(files ?? [])].slice(0, Math.max(0, 8 - m.images.length));
    if (!list.length) return;
    setUp(true);
    try {
      const urls: string[] = [];
      for (const file of list) {
        const fd = new FormData();
        fd.set("venueId", ctx.data.venue.id);
        fd.set("file", file);
        const r = await fetch("/api/admin/ticket/upload", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) showToast(j.error ?? "Không tải được ảnh.", "error");
        else urls.push(j.url);
      }
      if (urls.length) await ctx.call("menuImages", { id: m.id, images: [...m.images, ...urls] }, { quiet: true });
    } finally {
      setUp(false);
    }
  }
  return (
    <div style={{ ...rowCss, background: m ? "white" : "oklch(0.98 0.01 80)" }}>
      {m && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: "none" }}>
          <label title="Bấm để thêm ảnh món (chọn được nhiều ảnh)" style={{ cursor: "pointer", position: "relative", width: 56, height: 44, borderRadius: 9, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: MUTED, background: "repeating-linear-gradient(-45deg, oklch(0.95 0.02 160) 0 8px, oklch(0.975 0.01 160) 8px 16px)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.images[0] ? <img src={m.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : up ? "…" : "+ ảnh"}
            {m.images.length > 1 && <span style={{ position: "absolute", right: 2, bottom: 2, fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999, background: "oklch(0.2 0.02 160 / .75)", color: "white" }}>{m.images.length}</span>}
            <input type="file" accept="image/*" multiple hidden disabled={up} onChange={(e) => { void addImages(e.target.files); e.target.value = ""; }} />
          </label>
          {m.images.length > 0 && <span onClick={() => !ctx.busy && window.confirm(`Bỏ hết ảnh của món "${m.name}"?`) && ctx.call("menuImages", { id: m.id, images: [] }, { quiet: true })} style={{ cursor: "pointer", fontSize: 10, fontWeight: 800, color: RED }}>Bỏ ảnh</span>}
        </div>
      )}
      <label style={{ ...lbl, flex: "2 1 160px" }}>{m ? "Tên món" : "Thêm món"}<input style={small} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Lẩu gà đen, Trà Shan tuyết…" /></label>
      <label style={{ ...lbl, flex: "1 1 110px" }}>Nhóm<input style={small} value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} placeholder="Món chính, Đồ uống" /></label>
      <label style={{ ...lbl, flex: "1 1 110px" }}>Giá<Money value={f.price} onChange={(price) => setF({ ...f, price })} /></label>
      <label style={chk}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Còn bán</label>
      <Act kind="pri" disabled={ctx.busy} onClick={() => ctx.call("saveMenu", { item: { ...f, id: m?.id } })}>{m ? "Lưu" : "Thêm"}</Act>
      {m && <Act kind="warn" disabled={ctx.busy} onClick={() => window.confirm(`Xoá món "${m.name}"?`) && ctx.call("deleteMenu", { id: m.id })}>Xoá</Act>}
    </div>
  );
}

function TableRow({ ctx, t }: { ctx: Ctx; t: TkTable | null }) {
  const floors = ctx.data.venue.config.floors;
  const last = ctx.data.tables[ctx.data.tables.length - 1];
  const [f, setF] = useState({ name: t?.name ?? "", cap: String(t?.cap ?? 4), zone: t?.zone ?? last?.zone ?? "Trong nhà", floor: t?.floor ?? last?.floor ?? 0, round: t?.round ?? false, active: t?.active ?? true });
  return (
    <div style={{ ...rowCss, background: t ? "white" : "oklch(0.98 0.01 80)" }}>
      <label style={{ ...lbl, flex: "1 1 80px" }}>{t ? "Tên bàn" : "Thêm bàn"}<input style={small} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="T1" /></label>
      <label style={{ ...lbl, flex: "1 1 70px" }}>Số chỗ<input style={small} inputMode="numeric" value={f.cap} onChange={(e) => setF({ ...f, cap: digits(e.target.value) })} /></label>
      <label style={{ ...lbl, flex: "2 1 150px" }}>Khu<input style={small} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} placeholder="Ban công view mây" /></label>
      <label style={{ ...lbl, flex: "1 1 110px" }}>Tầng
        <select style={small} value={f.floor} onChange={(e) => setF({ ...f, floor: Number(e.target.value) })}>
          {floors.map((x, i) => <option key={i} value={i}>{x.name}</option>)}
        </select>
      </label>
      <label style={chk}><input type="checkbox" checked={f.round} onChange={(e) => setF({ ...f, round: e.target.checked })} />Bàn tròn</label>
      <label style={chk}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Đang dùng</label>
      <Act kind="pri" disabled={ctx.busy} onClick={() => ctx.call("saveTable", { table: { ...f, id: t?.id } })}>{t ? "Lưu" : "Thêm"}</Act>
      {t && <Act kind="warn" disabled={ctx.busy} onClick={() => window.confirm(`Xoá bàn ${t.name}?`) && ctx.call("deleteTable", { id: t.id })}>Xoá</Act>}
    </div>
  );
}
