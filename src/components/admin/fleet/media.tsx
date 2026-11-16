"use client";

import { useRef, useState, type CSSProperties } from "react";
import { isVideoUrl } from "@/lib/utils";
import { BORDER, G, MUTED } from "./ui";

/** Tải 1 tệp lên đội xe → url (hoặc lỗi). */
export async function uploadFleetFile(serviceId: string, file: File, imageOnly = false): Promise<{ url?: string; error?: string }> {
  const fd = new FormData();
  fd.append("serviceId", serviceId);
  fd.append("file", file);
  if (imageOnly) fd.append("imageOnly", "1");
  try {
    const res = await fetch("/api/admin/fleet/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) return { error: j.error ?? (res.status === 413 ? "Tệp quá lớn" : `Tải lên thất bại (${res.status})`) };
    return { url: j.url };
  } catch {
    return { error: "Mất kết nối khi tải lên" };
  }
}

export function MediaTile({ url, style }: { url: string; style?: CSSProperties }) {
  return isVideoUrl(url) ? (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "oklch(0.2 0.02 160)", ...style }}>
      <video src={url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 22, textShadow: "0 2px 8px #0008", pointerEvents: "none" }}>▶</span>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />
  );
}

/**
 * Quản lý ảnh + video của xe: nút "+ Thêm ảnh/video" (chọn nhiều tệp), kéo thả, xoá, đặt làm bìa.
 * `onChange` nhận danh sách mới (phần tử đầu là bìa). `big` = ô xem lớn ở trên.
 */
export function MediaManager({
  serviceId,
  media,
  onChange,
  say,
  disabled,
}: {
  serviceId: string;
  media: string[];
  onChange: (next: string[]) => void | Promise<unknown>;
  say: (t: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [view, setView] = useState(0);
  const [over, setOver] = useState(false);
  const cur = media[Math.min(view, media.length - 1)];

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/") || /\.(heic|heif|mov|mp4|m4v|webm)$/i.test(f.name));
    if (!list.length) return say("Chỉ nhận ảnh hoặc video");
    let next = [...media];
    const errs: string[] = [];
    setProg({ done: 0, total: list.length });
    for (const [i, f] of list.entries()) {
      const r = await uploadFleetFile(serviceId, f);
      if (r.url) next = [...next, r.url];
      else errs.push(`${f.name}: ${r.error}`);
      setProg({ done: i + 1, total: list.length });
    }
    setProg(null);
    if (next.length !== media.length) await onChange(next);
    if (errs.length) say(errs[0] + (errs.length > 1 ? ` (+${errs.length - 1} tệp lỗi)` : ""));
  };

  const pick = () => { if (!disabled && !prog) inputRef.current?.click(); };
  const remove = (u: string) => { if (confirm("Bỏ " + (isVideoUrl(u) ? "video" : "ảnh") + " này?")) { onChange(media.filter((x) => x !== u)); setView(0); } };
  const cover = (u: string) => { onChange([u, ...media.filter((x) => x !== u)]); setView(0); };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div onClick={media.length ? undefined : pick} style={{ position: "relative", aspectRatio: "16/9", borderRadius: 18, overflow: "hidden", border: `1.5px ${media.length ? "solid" : "dashed"} ${over ? G : media.length ? BORDER : "oklch(0.85 0.02 160)"}`, background: "oklch(0.97 0.006 160)", cursor: media.length ? "default" : "pointer" }}>
        {cur ? (
          isVideoUrl(cur) ? (
            <video key={cur} src={cur} controls playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "contain", background: "black", display: "block" }} />
          ) : (
            <MediaTile url={cur} />
          )
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: MUTED, fontSize: 14, fontWeight: 700, textAlign: "center", padding: 12 }}>
            <span style={{ fontSize: 28 }}>📷</span>
            {prog ? `Đang tải ${prog.done}/${prog.total}…` : "Bấm hoặc kéo thả ảnh / video xe vào đây"}
          </div>
        )}
        {cur && view === 0 && <span style={{ position: "absolute", left: 10, top: 10, fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: "white" }}>Ảnh bìa</span>}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {media.map((u, i) => (
          <div key={u} style={{ position: "relative", width: 64, height: 50, borderRadius: 10, overflow: "hidden", border: `2px solid ${i === view ? G : "transparent"}`, cursor: "pointer" }} onClick={() => setView(i)}>
            <MediaTile url={u} />
            <span onClick={(e) => { e.stopPropagation(); remove(u); }} title="Bỏ" style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", background: "#000a", color: "white", fontSize: 12, lineHeight: "18px", textAlign: "center" }}>×</span>
            {i > 0 && !isVideoUrl(u) && <span onClick={(e) => { e.stopPropagation(); cover(u); }} title="Đặt làm ảnh bìa" style={{ position: "absolute", bottom: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: "#000a", color: "white", fontSize: 11, lineHeight: "18px", textAlign: "center" }}>★</span>}
          </div>
        ))}
        <button type="button" onClick={pick} disabled={disabled || !!prog}
          style={{ height: 50, padding: "0 14px", borderRadius: 10, border: `1.5px dashed ${G}`, background: "oklch(0.97 0.02 155)", color: G, fontSize: 13, fontWeight: 800, cursor: prog ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {prog ? `Đang tải ${prog.done}/${prog.total}…` : "+ Thêm ảnh/video"}
        </button>
      </div>
      <span style={{ fontSize: 12, color: MUTED }}>Chọn được nhiều tệp một lúc · ảnh tới 25MB, video tới 200MB · ★ đặt ảnh bìa</span>
      <input ref={inputRef} type="file" accept="image/*,video/*,.heic,.heif,.mov" multiple style={{ display: "none" }}
        onChange={(e) => { const fl = e.target.files; if (fl?.length) addFiles(fl); e.target.value = ""; }} />
    </div>
  );
}
