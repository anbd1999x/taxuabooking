"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./Toast";
import { savePlace, togglePlacePublished, bulkPlaces, removePlace } from "@/app/admin/places/actions";
import type { PlaceDTO } from "@/app/admin/places/place-dto";

type Kind = "RESTAURANT" | "CAFE" | "CHECKIN";
const KINDS: Kind[] = ["RESTAURANT", "CAFE", "CHECKIN"];

const KIND_SLUG: Record<Kind, string> = { RESTAURANT: "nha-hang", CAFE: "cafe", CHECKIN: "lich-trinh" };
const KIND_NAME: Record<Kind, string> = { RESTAURANT: "Nhà hàng", CAFE: "Cafe", CHECKIN: "Điểm check-in" };
/** Link xem trên web: điểm check-in không có trang chi tiết riêng → về /lich-trinh. */
const webHref = (kind: string, slug: string) => (kind === "CHECKIN" ? "/lich-trinh" : `/${KIND_SLUG[kind as Kind] ?? "nha-hang"}/${slug}`);

const AREA_DEFAULTS = ["Trung tâm", "Đỉnh Gió", "Khe Cải", "Sống lưng khủng long", "Mống Vàng", "Thảo nguyên", "Làng Chếu"];
const TAG_SUGGEST = ["Gợi ý", "Đặc sản Tây Bắc", "Nhóm đông", "Lẩu nướng", "Cơm suất", "View săn mây", "Có đồ ăn", "Mở sớm", "Mở khuya", "Ngoài trời", "Có homestay"];
const BOOKING_OPTS: { v: string; label: string }[] = [
  { v: "no", label: "Không nhận, tới sớm" },
  { v: "call", label: "Gọi trước" },
  { v: "group", label: "Chỉ nhóm từ 6 người" },
];

type TabKey = "info" | "hours" | "photos" | "desc";

/** Trạng thái form trong slide-over (phẳng, dễ set từng ô). */
interface FormState {
  id: string | null;
  kind: Kind;
  name: string;
  slug: string;
  area: string;
  price: string;
  order: number;
  open: string;
  close: string;
  hoursWeekend: string;
  booking: string;
  phone: string;
  zalo: string;
  address: string;
  mapUrl: string;
  short: string;
  tip: string;
  content: string;
  tags: string[];
  coverImage: string;
  images: string[];
  published: boolean;
}

function parseHours(hours: string): [string, string] {
  const m = hours.match(/(\d{1,2}):(\d{2})\s*[–\-~]+\s*(\d{1,2}):(\d{2})/);
  if (!m) return ["", ""];
  const pad = (h: string) => h.padStart(2, "0");
  return [`${pad(m[1])}:${m[2]}`, `${pad(m[3])}:${m[4]}`];
}

function toForm(p: PlaceDTO): FormState {
  const [open, close] = parseHours(p.hours);
  return {
    id: p.id,
    kind: (KINDS.includes(p.kind as Kind) ? p.kind : "RESTAURANT") as Kind,
    name: p.name,
    slug: p.slug,
    area: p.area || AREA_DEFAULTS[0],
    price: p.price,
    order: p.sortOrder,
    open,
    close,
    hoursWeekend: p.hoursWeekend,
    booking: p.booking || "no",
    phone: p.phone,
    zalo: p.zalo,
    address: p.address,
    mapUrl: p.mapUrl,
    short: p.desc,
    tip: p.tip,
    content: p.content,
    tags: [...p.tags],
    coverImage: p.coverImage,
    images: [...p.images],
    published: p.published,
  };
}

function blankForm(kind: Kind, order: number): FormState {
  return {
    id: null, kind, name: "", slug: "", area: AREA_DEFAULTS[0], price: "", order,
    open: "", close: "", hoursWeekend: "", booking: "no", phone: "", zalo: "", address: "", mapUrl: "",
    short: "", tip: "", content: "", tags: [], coverImage: "", images: [], published: false,
  };
}

/** % hoàn thiện: ảnh bìa, giờ mở–đóng, mô tả ngắn, bản đồ/địa chỉ, SĐT, ảnh khác. */
function completion(p: PlaceDTO): number {
  const open = p.hours && parseHours(p.hours)[0];
  const checks = [!!p.coverImage, !!open, !!p.desc, !!(p.mapUrl || p.address), !!p.phone, p.images.length > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("standalone", "1");
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Tải ảnh thất bại (mã ${res.status}).`);
  return data.url as string;
}

const INPUT = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[15px] focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/20";
const FIELD_LABEL = "flex flex-col gap-1.5 text-xs font-bold text-gray-500";

export function PlacesManager({ initialPlaces, areas: areaProp }: { initialPlaces: PlaceDTO[]; areas: string[] }) {
  const router = useRouter();
  const [items, setItems] = useState<PlaceDTO[]>(initialPlaces);
  // Đồng bộ lại với dữ liệu server mỗi khi router.refresh() trả về bản mới
  // (cập nhật lạc quan ở trên giữ nguyên cho tới khi server trả dữ liệu thật).
  // Mẫu "điều chỉnh state khi render" của React — dùng state, không dùng ref.
  const [lastServer, setLastServer] = useState(initialPlaces);
  if (lastServer !== initialPlaces) {
    setLastServer(initialPlaces);
    setItems(initialPlaces);
  }

  const [kind, setKind] = useState<Kind>("RESTAURANT");
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all"); // 'all' | 'hidden' | 'missing' | <area>
  const [sort, setSort] = useState("order");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [tab, setTab] = useState<TabKey>("info");
  const [descMode, setDescMode] = useState<"edit" | "prev">("edit");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const areaList = useMemo(() => {
    const set = new Set<string>([...AREA_DEFAULTS, ...areaProp.filter(Boolean)]);
    return Array.from(set);
  }, [areaProp]);

  const mine = useMemo(() => items.filter((x) => x.kind === kind), [items, kind]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = mine.filter((x) => {
      const areaOk =
        area === "all" ? true :
        area === "hidden" ? !x.published :
        area === "missing" ? completion(x) < 70 :
        x.area === area;
      const qOk = !term || `${x.name} ${x.slug} ${x.area}`.toLowerCase().includes(term);
      return areaOk && qOk;
    });
    list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name, "vi") :
      sort === "missing" ? completion(a) - completion(b) :
      sort === "updated" ? b.updatedAt - a.updatedAt :
      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"),
    );
    return list;
  }, [mine, q, area, sort]);

  const selIds = useMemo(() => rows.filter((r) => sel[r.id]).map((r) => r.id), [rows, sel]);
  const allSel = rows.length > 0 && rows.every((r) => sel[r.id]);

  // Reset lựa chọn khi đổi loại quán.
  function pickKind(k: Kind) { setKind(k); setSel({}); setArea("all"); }

  function refresh() { startTransition(() => router.refresh()); }

  function optimistic(fn: (list: PlaceDTO[]) => PlaceDTO[]) { setItems((cur) => fn(cur)); }

  async function togglePub(p: PlaceDTO) {
    optimistic((l) => l.map((x) => (x.id === p.id ? { ...x, published: !x.published } : x)));
    showToast(p.published ? `Đã ẩn "${p.name}"` : `Đã hiện "${p.name}"`, "ok");
    await togglePlacePublished(p.id, !p.published);
    refresh();
  }

  async function doBulk(op: "show" | "hide" | "delete") {
    const ids = [...selIds];
    if (!ids.length) return;
    if (op === "delete" && !confirm(`Xoá ${ids.length} quán? Trang chi tiết sẽ mất.`)) return;
    optimistic((l) =>
      op === "delete" ? l.filter((x) => !ids.includes(x.id)) : l.map((x) => (ids.includes(x.id) ? { ...x, published: op === "show" } : x)),
    );
    setSel({});
    const res = await bulkPlaces(ids, op);
    showToast(res.ok ? `Đã ${op === "delete" ? "xoá" : op === "show" ? "hiện" : "ẩn"} ${ids.length} quán` : res.error ?? "Thất bại", res.ok ? "ok" : "error");
    refresh();
  }

  function openEdit(p: PlaceDTO) { setForm(toForm(p)); setTab("info"); setDescMode("edit"); setErr(""); }
  function openNew() { setForm(blankForm(kind, mine.length)); setTab("info"); setDescMode("edit"); setErr(""); }
  function closeEdit() { setForm(null); setErr(""); }

  function patch(p: Partial<FormState>) { setForm((f) => (f ? { ...f, ...p } : f)); setErr(""); }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setErr("Nhập tên quán trước khi lưu."); setTab("info"); return; }
    if (form.short.length > 160) { setErr("Mô tả ngắn tối đa 160 ký tự."); setTab("info"); return; }
    const res = await savePlace({
      id: form.id ?? undefined,
      kind: form.kind,
      name: form.name,
      slug: form.slug,
      area: form.area,
      price: form.price,
      open: form.open,
      close: form.close,
      hoursWeekend: form.hoursWeekend,
      booking: form.booking,
      phone: form.phone,
      zalo: form.zalo,
      address: form.address,
      mapUrl: form.mapUrl,
      desc: form.short,
      tip: form.tip,
      content: form.content,
      tags: form.tags,
      coverImage: form.coverImage,
      images: form.images,
      sortOrder: Number(form.order) || 0,
      published: form.published,
    });
    if (!res.ok || !res.place) { setErr(res.error ?? "Lưu thất bại."); return; }
    const saved = res.place;
    optimistic((l) => (l.some((x) => x.id === saved.id) ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved]));
    setKind(saved.kind as Kind);
    closeEdit();
    showToast(res.message ?? "Đã lưu", "ok");
    refresh();
  }

  async function delCurrent() {
    if (!form?.id) return;
    if (!confirm(`Xoá "${form.name}"? Trang chi tiết sẽ mất.`)) return;
    const id = form.id;
    optimistic((l) => l.filter((x) => x.id !== id));
    closeEdit();
    const res = await removePlace(id);
    showToast(res.ok ? "Đã xoá quán" : res.error ?? "Thất bại", res.ok ? "ok" : "error");
    refresh();
  }

  const stats: { k: string; v: number; filter: string; tone: string }[] = [
    { k: "Tổng", v: mine.length, filter: "all", tone: "text-ink" },
    { k: "Đang hiện", v: mine.filter((x) => x.published).length, filter: "all", tone: "text-forest-600" },
    { k: "Đang ẩn", v: mine.filter((x) => !x.published).length, filter: "hidden", tone: "text-gray-500" },
    { k: "Thiếu thông tin", v: mine.filter((x) => completion(x) < 70).length, filter: "missing", tone: "text-sunset-600" },
  ];

  const isNew = form ? form.id === null : false;
  const tabWarn: Record<TabKey, boolean> = form
    ? { info: !form.name || !form.short, hours: !form.open || !form.close, photos: !form.coverImage, desc: false }
    : { info: false, hours: false, photos: false, desc: false };

  return (
    <div className="max-w-[1240px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[clamp(22px,3vw,28px)] font-extrabold tracking-[-0.02em] text-ink">Nhà hàng &amp; Cafe</h1>
          <p className="mt-1 text-sm text-gray-500">
            {mine.length} {KIND_NAME[kind].toLowerCase()} · {mine.filter((x) => x.published).length} đang hiện trên{" "}
            <Link href={`/${KIND_SLUG[kind]}`} target="_blank" className="font-semibold text-forest-700 hover:underline">/{KIND_SLUG[kind]}</Link>{" "}
            · bấm tên quán để sửa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => pickKind(k)}
                className={`rounded-lg px-3.5 py-2 text-sm font-bold ${kind === k ? "bg-white text-forest-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {KIND_NAME[k]} <span className="font-semibold opacity-60">{items.filter((x) => x.kind === k).length}</span>
              </button>
            ))}
          </div>
          <button onClick={openNew} className="rounded-full bg-sunset-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sunset-600">
            + Thêm quán
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
        {stats.map((s) => (
          <button
            key={s.k}
            onClick={() => setArea((a) => (a === s.filter ? "all" : s.filter))}
            className={`rounded-2xl border bg-white px-4 py-3.5 text-left transition hover:shadow-sm ${area === s.filter && s.filter !== "all" ? "border-forest-600 ring-1 ring-forest-600" : "border-gray-200"}`}
          >
            <div className="text-xs font-semibold text-gray-500">{s.k}</div>
            <div className={`mt-0.5 text-2xl font-extrabold tracking-[-0.02em] ${s.tone}`}>{s.v}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên quán, khu vực, slug…"
          className="min-w-[200px] flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:border-forest-500 focus:outline-none"
        />
        <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold focus:border-forest-500 focus:outline-none">
          <option value="all">Mọi khu vực</option>
          <option value="hidden">Chỉ quán đang ẩn</option>
          <option value="missing">Chỉ quán thiếu thông tin</option>
          {areaList.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold focus:border-forest-500 focus:outline-none">
          <option value="order">Thứ tự hiển thị</option>
          <option value="name">Tên A→Z</option>
          <option value="missing">Thiếu thông tin trước</option>
          <option value="updated">Mới sửa gần đây</option>
        </select>
      </div>

      {/* Bulk bar */}
      {selIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white">
          <span>Đã chọn {selIds.length} quán</span>
          <span className="flex-1" />
          <button onClick={() => doBulk("show")} className="rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">Hiện</button>
          <button onClick={() => doBulk("hide")} className="rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">Ẩn</button>
          <button onClick={() => doBulk("delete")} className="rounded-full bg-red-500 px-3 py-1.5 hover:bg-red-600">Xoá</button>
          <button onClick={() => setSel({})} className="px-2 py-1.5 opacity-80 hover:opacity-100">Bỏ chọn</button>
        </div>
      )}

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {/* Header row (chỉ màn rộng) */}
        <div className="hidden grid-cols-[36px_44px_minmax(0,2.2fr)_minmax(0,1fr)_96px_minmax(0,1fr)_112px_96px] items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 lg:grid">
          <input type="checkbox" checked={allSel} onChange={() => { const on = !allSel; const next: Record<string, boolean> = {}; rows.forEach((r) => (next[r.id] = on)); setSel(next); }} className="h-4 w-4 accent-forest-600" />
          <span />
          <span>Quán</span><span>Khu vực</span><span>Giờ mở</span><span>Hoàn thiện</span><span>Trạng thái</span><span />
        </div>

        {rows.map((r) => {
          const pct = completion(r);
          const pctColor = pct >= 80 ? "bg-forest-500" : pct >= 50 ? "bg-amber-400" : "bg-sunset-500";
          const [open, close] = parseHours(r.hours);
          return (
            <div
              key={r.id}
              className={`grid grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-50 px-4 py-3 transition hover:bg-forest-50/40 lg:grid-cols-[36px_44px_minmax(0,2.2fr)_minmax(0,1fr)_96px_minmax(0,1fr)_112px_96px] ${sel[r.id] ? "bg-forest-50" : ""} ${r.published ? "" : "opacity-70"}`}
            >
              <input type="checkbox" checked={!!sel[r.id]} onChange={() => setSel((s) => ({ ...s, [r.id]: !s[r.id] }))} className="h-4 w-4 accent-forest-600" />
              <div className="h-11 w-11 flex-none overflow-hidden rounded-[10px] bg-gray-100">
                {r.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-lg">{r.kind === "CAFE" ? "☕" : r.kind === "CHECKIN" ? "📍" : "🍲"}</div>
                )}
              </div>
              <button onClick={() => openEdit(r)} className="min-w-0 text-left">
                <div className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">{r.name || "Quán chưa đặt tên"}</div>
                <div className="truncate text-xs text-gray-500">/{KIND_SLUG[r.kind as Kind]}/{r.slug}{r.desc ? "" : " · chưa có mô tả ngắn"}</div>
              </button>

              {/* Cột rộng */}
              <span className="hidden truncate text-sm font-semibold lg:block">{r.area}</span>
              <span className={`hidden whitespace-nowrap text-sm font-semibold lg:block ${open ? "text-ink" : "text-sunset-600"}`}>{open && close ? `${open}–${close}` : "Chưa nhập"}</span>
              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${pctColor}`} style={{ width: `${pct}%` }} /></div>
                <span className="whitespace-nowrap text-xs font-bold text-gray-500">{pct}%</span>
              </div>
              <button onClick={() => togglePub(r)} className="hidden items-center gap-2 text-left text-[13px] font-bold lg:inline-flex" title="Bật/tắt hiển thị trên web">
                <span className={`relative h-5 w-9 flex-none rounded-full transition ${r.published ? "bg-forest-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${r.published ? "left-[18px]" : "left-0.5"}`} />
                </span>
                <span className={r.published ? "text-forest-700" : "text-gray-500"}>{r.published ? "Đang hiện" : "Đang ẩn"}</span>
              </button>

              <div className="flex justify-end gap-1.5">
                <button onClick={() => openEdit(r)} className="rounded-full bg-forest-800 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-forest-700">Sửa</button>
                <Link href={webHref(r.kind, r.slug)} target="_blank" title="Xem trên web" className="rounded-full border border-gray-200 px-2.5 py-1.5 text-[13px] font-bold text-gray-600 hover:bg-gray-50">↗</Link>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && <div className="p-10 text-center text-sm text-gray-500">Không có quán nào khớp bộ lọc.</div>}
      </div>
      <p className="mt-2 text-[13px] text-gray-500">Thanh &quot;Hoàn thiện&quot; tính theo ảnh bìa, giờ mở, mô tả ngắn, bản đồ/địa chỉ và SĐT.</p>

      {form && (
        <Editor
          form={form}
          patch={patch}
          areaList={areaList}
          tab={tab}
          setTab={setTab}
          tabWarn={tabWarn}
          descMode={descMode}
          setDescMode={setDescMode}
          isNew={isNew}
          err={err}
          pending={pending}
          onClose={closeEdit}
          onSave={save}
          onDelete={delCurrent}
        />
      )}
    </div>
  );
}

// ── Slide-over editor ────────────────────────────────────────────────────────

function descToBlocks(desc: string) {
  return desc
    .split("\n")
    .filter((l) => l.trim())
    .map((l) =>
      l.startsWith("## ")
        ? { t: l.slice(3), cls: "mt-2 text-lg font-extrabold text-ink" }
        : l.startsWith("- ")
          ? { t: `• ${l.slice(2)}`, cls: "pl-3 text-[15px] text-gray-700" }
          : { t: l, cls: "text-[15px] text-gray-700" },
    );
}

function Editor({
  form, patch, areaList, tab, setTab, tabWarn, descMode, setDescMode, isNew, err, pending, onClose, onSave, onDelete,
}: {
  form: FormState;
  patch: (p: Partial<FormState>) => void;
  areaList: string[];
  tab: TabKey;
  setTab: (t: TabKey) => void;
  tabWarn: Record<TabKey, boolean>;
  descMode: "edit" | "prev";
  setDescMode: (m: "edit" | "prev") => void;
  isNew: boolean;
  err: string;
  pending: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const kindName = KIND_NAME[form.kind];
  const kindSlug = KIND_SLUG[form.kind];
  const [coverBusy, setCoverBusy] = useState(false);
  const [galBusy, setGalBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverBusy(true);
    try { patch({ coverImage: await uploadImage(file) }); showToast("Đã tải ảnh bìa", "ok"); }
    catch (x) { showToast(x instanceof Error ? x.message : "Tải ảnh thất bại.", "error"); }
    finally { setCoverBusy(false); if (coverRef.current) coverRef.current.value = ""; }
  }

  async function onGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setGalBusy(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadImage(f));
      patch({ images: [...form.images, ...urls] });
      showToast(`Đã tải ${urls.length} ảnh`, "ok");
    } catch (x) { showToast(x instanceof Error ? x.message : "Tải ảnh thất bại.", "error"); }
    finally { setGalBusy(false); if (galRef.current) galRef.current.value = ""; }
  }

  const tabs: { k: TabKey; name: string }[] = [
    { k: "info", name: "Thông tin" },
    { k: "hours", name: "Giờ & liên hệ" },
    { k: "photos", name: "Ảnh" },
    { k: "desc", name: "Mô tả chi tiết" },
  ];
  const tagOpts = Array.from(new Set([...TAG_SUGGEST, ...form.tags]));
  const hoursPreview = form.open && form.close
    ? `${form.open} – ${form.close}${form.hoursWeekend ? ` (cuối tuần mở ${form.hoursWeekend})` : ""}`
    : "Chưa cập nhật giờ mở cửa";
  const blocks = descToBlocks(form.content);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/40 animate-[fadeIn_.2s_ease]" />
      <div className="fixed inset-y-0 right-0 z-50 flex w-[min(760px,100vw)] flex-col bg-gray-50 shadow-2xl animate-[slideIn_.3s_cubic-bezier(.2,.7,.2,1)]">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-4">
          <button onClick={onClose} className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-100 text-lg hover:bg-gray-200">←</button>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-gray-500">{isNew ? `Thêm ${kindName.toLowerCase()} mới` : `Sửa ${kindName.toLowerCase()} · /${kindSlug}/${form.slug}`}</div>
            <div className="truncate text-[17px] font-extrabold tracking-[-0.01em] text-ink">{form.name || "Quán chưa đặt tên"}</div>
          </div>
          {!isNew && form.slug && (
            <Link href={webHref(form.kind, form.slug)} target="_blank" className="whitespace-nowrap rounded-full border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Xem ↗</Link>
          )}
        </div>

        {/* tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-[2.5px] px-3.5 py-2.5 text-sm font-bold ${tab === t.k ? "border-forest-700 text-forest-800" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t.name}
              {tabWarn[t.k] && <span className="h-[7px] w-[7px] rounded-full bg-sunset-500" />}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "info" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={`${FIELD_LABEL} sm:col-span-2`}>Tên quán *
                <input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="VD: Panorama Coffee" className={`${INPUT} text-base font-semibold ${err && !form.name ? "border-red-400" : ""}`} />
              </label>
              <label className={FIELD_LABEL}>Loại
                <select value={form.kind} onChange={(e) => patch({ kind: e.target.value as Kind })} className={INPUT}>
                  <option value="RESTAURANT">Nhà hàng</option>
                  <option value="CAFE">Cafe</option>
                  <option value="CHECKIN">Điểm check-in</option>
                </select>
              </label>
              <label className={FIELD_LABEL}>Khu vực *
                <select value={form.area} onChange={(e) => patch({ area: e.target.value })} className={INPUT}>
                  {Array.from(new Set([form.area, ...areaList])).filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className={FIELD_LABEL}>Thứ tự
                <input type="number" value={form.order} onChange={(e) => patch({ order: Number(e.target.value) })} className={INPUT} />
              </label>
              <label className={FIELD_LABEL}>Giá từ
                <input value={form.price} onChange={(e) => patch({ price: e.target.value })} placeholder="40.000đ (để trống = Theo menu)" className={INPUT} />
              </label>
              <label className={`${FIELD_LABEL} sm:col-span-2`}>Đường dẫn (slug)
                <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <span className="whitespace-nowrap py-2.5 pl-3.5 text-sm text-gray-500">/{kindSlug}/</span>
                  <input value={form.slug} onChange={(e) => patch({ slug: e.target.value })} className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-3.5 pl-0.5 font-mono text-sm focus:outline-none" />
                </div>
                <span className="font-medium text-gray-400">Để trống sẽ tự tạo từ tên quán.</span>
              </label>
              <label className={`${FIELD_LABEL} sm:col-span-2`}>Mô tả ngắn <span className="font-medium text-gray-400">· hiện ở thẻ quán và Google ({form.short.length}/160)</span>
                <textarea value={form.short} onChange={(e) => patch({ short: e.target.value })} rows={2} placeholder="Một câu: điểm đặc biệt + nên tới lúc nào." className={`${INPUT} resize-y leading-relaxed`} />
              </label>
              <label className={`${FIELD_LABEL} sm:col-span-2`}>Mẹo cho khách <span className="font-medium text-gray-400">· hiện ở thẻ trên trang Lịch trình</span>
                <input value={form.tip} onChange={(e) => patch({ tip: e.target.value })} maxLength={200} placeholder="VD: Tới trước 6h để có ảnh vắng người." className={INPUT} />
              </label>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <div className="text-xs font-bold text-gray-500">Đặc điểm</div>
                <div className="flex flex-wrap gap-1.5">
                  {tagOpts.map((t) => {
                    const on = form.tags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => patch({ tags: on ? form.tags.filter((x) => x !== t) : [...form.tags, t] })}
                        className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-forest-700 bg-forest-700 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === "hours" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={FIELD_LABEL}>Mở cửa
                  <input type="time" value={form.open} onChange={(e) => patch({ open: e.target.value })} className={INPUT} />
                </label>
                <label className={FIELD_LABEL}>Đóng cửa
                  <input type="time" value={form.close} onChange={(e) => patch({ close: e.target.value })} className={INPUT} />
                </label>
                <label className={FIELD_LABEL}>Cuối tuần mở sớm
                  <input type="time" value={form.hoursWeekend} onChange={(e) => patch({ hoursWeekend: e.target.value })} className={INPUT} />
                </label>
                <label className={FIELD_LABEL}>Nhận đặt bàn
                  <select value={form.booking} onChange={(e) => patch({ booking: e.target.value })} className={INPUT}>
                    {BOOKING_OPTS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                  </select>
                </label>
                <label className={FIELD_LABEL}>Số điện thoại
                  <input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="0xxx xxx xxx" className={INPUT} />
                </label>
                <label className={FIELD_LABEL}>Zalo
                  <input value={form.zalo} onChange={(e) => patch({ zalo: e.target.value })} placeholder="Giống SĐT nếu để trống" className={INPUT} />
                </label>
                <label className={`${FIELD_LABEL} sm:col-span-2`}>Địa chỉ chi tiết
                  <input value={form.address} onChange={(e) => patch({ address: e.target.value })} placeholder="VD: Khu Đỉnh Gió, cách chợ 1,2km" className={INPUT} />
                </label>
                <label className={`${FIELD_LABEL} sm:col-span-2`}>Link Google Maps
                  <input value={form.mapUrl} onChange={(e) => patch({ mapUrl: e.target.value })} placeholder="Dán link chia sẻ (để trống = tự tìm theo tên)" className={`${INPUT} text-sm`} />
                </label>
              </div>
              <div className="rounded-xl bg-forest-50 px-4 py-3.5 text-[13px] leading-relaxed text-forest-800">
                Khách sẽ thấy: <b>{hoursPreview}</b>. Nhãn &quot;Đang mở / Đã đóng&quot; trên web tự tính từ giờ này.
              </div>
            </div>
          )}

          {tab === "photos" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="text-xs font-bold text-gray-500">Ảnh bìa <span className="font-medium text-gray-400">· ngang 16:9, hiện đầu trang và khi chia sẻ link</span></div>
                <label className="relative block aspect-[16/7] cursor-pointer overflow-hidden rounded-2xl border-[1.5px] border-dashed border-gray-300 bg-white">
                  {form.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.coverImage} alt="Ảnh bìa" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-400">{coverBusy ? "Đang tải…" : "Bấm để chọn ảnh bìa"}</div>
                  )}
                  <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={onCover} disabled={coverBusy} />
                </label>
                {form.coverImage && <button onClick={() => patch({ coverImage: "" })} className="self-start text-xs font-semibold text-red-500 hover:underline">Gỡ ảnh bìa</button>}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-gray-500">Ảnh khác <span className="font-medium text-gray-400">· {form.images.length} ảnh</span></div>
                  <label className={`cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-bold ${galBusy ? "opacity-60" : "hover:bg-gray-50"}`}>
                    {galBusy ? "Đang tải…" : "+ Thêm ảnh"}
                    <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={onGallery} disabled={galBusy} />
                  </label>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))" }}>
                  {form.images.map((u, i) => (
                    <div key={`${u}-${i}`} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
                      <button onClick={() => patch({ images: form.images.filter((_, j) => j !== i) })} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[13px] text-white hover:bg-black/80">✕</button>
                    </div>
                  ))}
                  <label className={`flex aspect-[4/3] cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-dashed border-gray-300 text-[13px] font-bold text-gray-500 ${galBusy ? "opacity-60" : "hover:bg-gray-50"}`}>
                    + Ảnh
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onGallery} disabled={galBusy} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === "desc" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-gray-500">Mô tả chi tiết <span className="font-medium text-gray-400">· để trống sẽ tự dựng từ thông tin trên</span></div>
                <div className="inline-flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
                  <button onClick={() => setDescMode("edit")} className={`rounded-md px-2.5 py-1 text-xs font-bold ${descMode === "edit" ? "bg-white shadow-sm" : "text-gray-500"}`}>Soạn</button>
                  <button onClick={() => setDescMode("prev")} className={`rounded-md px-2.5 py-1 text-xs font-bold ${descMode === "prev" ? "bg-white shadow-sm" : "text-gray-500"}`}>Xem trước</button>
                </div>
              </div>
              {descMode === "edit" ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ["+ Tiêu đề", "\n## Không gian & món nên gọi\n"],
                      ["+ Món & giá", "\n- Tên món — 50.000đ\n"],
                      ["+ Lưu ý", "\n## Lưu ý\nNhóm đông nên gọi trước 15h.\n"],
                    ].map(([name, txt]) => (
                      <button key={name} onClick={() => patch({ content: (form.content + txt).replace(/^\n/, "") })} className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold hover:bg-gray-50">{name}</button>
                    ))}
                  </div>
                  <textarea
                    value={form.content}
                    onChange={(e) => patch({ content: e.target.value })}
                    rows={14}
                    placeholder={"## Không gian & món nên gọi\nMô tả quán...\n\n- Món 1 — 50.000đ\n- Món 2 — 80.000đ"}
                    className={`${INPUT} resize-y font-mono text-sm leading-relaxed`}
                  />
                  <div className="text-xs text-gray-400">Hỗ trợ: <code>## Tiêu đề</code>, <code>- gạch đầu dòng</code>, <code>**đậm**</code>.</div>
                </>
              ) : (
                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5 text-[15px] leading-relaxed">
                  {blocks.length ? blocks.map((b, i) => <div key={i} className={b.cls}>{b.t}</div>) : (
                    <div className="italic text-gray-500">Chưa có nội dung. Web sẽ tự dựng mô tả từ giờ mở, khu vực và đặc điểm.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="relative flex flex-wrap items-center gap-2.5 border-t border-gray-200 bg-white px-5 py-3.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.published} onChange={(e) => patch({ published: e.target.checked })} className="h-[18px] w-[18px] accent-forest-600" />
            Hiện trên web
          </label>
          <span className="flex-1" />
          {!isNew && <button onClick={onDelete} className="rounded-full px-3.5 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50">Xoá quán</button>}
          <button onClick={onClose} className="rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold hover:bg-gray-50">Huỷ</button>
          <button onClick={onSave} disabled={pending} className="rounded-full bg-forest-800 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-sunset-500 disabled:opacity-60">
            {isNew ? "Tạo quán" : "Lưu thay đổi"}
          </button>
          {err && <div className="absolute inset-x-5 bottom-[66px] rounded-lg bg-red-500 px-3.5 py-2.5 text-[13px] font-semibold text-white">{err}</div>}
        </div>
      </div>
    </>
  );
}
