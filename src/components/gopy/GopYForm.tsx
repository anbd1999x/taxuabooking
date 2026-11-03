"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FeedbackType } from "@prisma/client";
import { FEEDBACK_AREAS, FEEDBACK_MOODS, FEEDBACK_TYPES, feedbackType } from "@/lib/feedback";
import { submitFeedback, type SubmitState } from "@/app/(site)/gop-y/actions";

const LOGIN_HREF = "/tai-khoan?next=/gop-y";

export function GopYForm({ loggedIn, userName }: { loggedIn: boolean; userName: string }) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(submitFeedback, {});
  const [type, setType] = useState<FeedbackType>("IDEA");
  const [mood, setMood] = useState(0);
  const [areas, setAreas] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [anon, setAnon] = useState(false);
  const [shot, setShot] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Sau khi gửi thành công → reset các ô (state.ok giữ để hiện màn cảm ơn).
  useEffect(() => {
    if (state.ok) {
      setMsg("");
      setMood(0);
      setAreas([]);
      setShot("");
    }
  }, [state.ok]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!loggedIn) return;
    setUpErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/gop-y/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setUpErr(data.error || "Tải ảnh thất bại.");
      else setShot(data.url);
    } catch {
      setUpErr("Tải ảnh thất bại. Thử lại nhé.");
    } finally {
      setUploading(false);
    }
  }

  const n = msg.trim().length;

  if (state.ok) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-100 text-2xl font-extrabold text-forest-700">
          ✓
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">Cảm ơn bạn đã góp ý!</h2>
        <p className="text-[15px] leading-relaxed text-gray-600">
          Mã góp ý <b className="font-mono text-ink">{state.code}</b>. Góp ý đã hiện trên bảng công khai bên dưới
          {anon ? " (ẩn tên)" : ""}. Tụi mình sẽ trả lời ngay dưới góp ý của bạn.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/gop-y"
            className="rounded-full bg-forest-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-forest-800"
          >
            Gửi góp ý khác
          </a>
          <Link href="/" className="rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">
            Về trang chủ
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
    >
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink">Gửi góp ý</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Góp ý sẽ hiện công khai trên bảng bên dưới để mọi người cùng xem và bình chọn.
        </p>
      </div>

      {!loggedIn && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sunset-200 bg-sunset-50 px-4 py-3">
          <span className="text-sm text-sunset-800">
            <b>Cần đăng nhập</b> để gửi góp ý, bình chọn và bình luận.
          </span>
          <Link href={LOGIN_HREF} className="whitespace-nowrap rounded-full bg-forest-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-forest-800">
            Đăng nhập
          </Link>
        </div>
      )}

      {/* Loại góp ý */}
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-bold text-gray-700">Bạn muốn góp ý về</div>
        <div className="grid grid-cols-2 gap-2">
          {FEEDBACK_TYPES.map((t) => {
            const on = type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={`rounded-2xl border p-3 text-left transition ${
                  on ? "border-forest-600 bg-forest-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className={`text-sm font-extrabold ${on ? "text-forest-700" : "text-ink"}`}>{t.name}</div>
                <div className="mt-0.5 text-xs leading-snug text-gray-500">{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chấm trải nghiệm */}
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-bold text-gray-700">Trải nghiệm chung với website</div>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_MOODS.map((name, i) => {
            const val = i + 1;
            const on = mood === val;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setMood(on ? 0 : val)}
                className={`flex min-w-[72px] flex-1 flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 transition ${
                  on ? "border-sunset-400 bg-sunset-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className={`text-lg font-extrabold ${on ? "text-sunset-600" : "text-gray-400"}`}>{val}</span>
                <span className="whitespace-nowrap text-[11px] font-bold text-gray-500">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Khu vực liên quan */}
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-bold text-gray-700">
          Trang hoặc tính năng liên quan <span className="font-medium text-gray-400">(không bắt buộc)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_AREAS.map((a) => {
            const on = areas.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAreas((prev) => (on ? prev.filter((x) => x !== a) : [...prev, a]))}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                  on ? "border-forest-600 bg-forest-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nội dung */}
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-[13px] font-bold text-gray-700">
          <span>Nội dung góp ý</span>
          <span className={`font-medium ${n > 0 && n < 15 ? "text-sunset-600" : "text-gray-400"}`}>{n}/1000</span>
        </span>
        <textarea
          name="message"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder={feedbackType(type).ph}
          className="resize-y rounded-2xl border border-gray-200 bg-gray-50/60 px-3.5 py-3 text-[15px] leading-relaxed focus:border-forest-400 focus:bg-white focus:outline-none"
        />
      </label>

      {/* Ảnh chụp màn hình */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-gray-700">
          Ảnh chụp màn hình <span className="font-medium text-gray-400">(nếu báo lỗi)</span>
        </span>
        {shot ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot} alt="Ảnh chụp màn hình" className="max-h-40 rounded-xl border border-gray-200" />
            <button
              type="button"
              onClick={() => setShot("")}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white"
              aria-label="Xoá ảnh"
            >
              ×
            </button>
          </div>
        ) : (
          <label
            className={`flex h-24 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 text-sm text-gray-400 ${
              loggedIn ? "hover:border-forest-400 hover:text-forest-600" : "cursor-not-allowed opacity-60"
            }`}
          >
            {uploading ? "Đang tải ảnh…" : "Kéo thả hoặc bấm để chọn ảnh"}
            <input type="file" accept="image/*" className="hidden" disabled={!loggedIn || uploading} onChange={onFile} />
          </label>
        )}
        {upErr && <span className="text-[13px] font-semibold text-red-600">{upErr}</span>}
      </div>

      {/* Ẩn danh (khi đã đăng nhập) */}
      {loggedIn && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
          <div className="text-sm">
            <span className="font-bold text-ink">Gửi với tên {anon ? '"Ẩn danh"' : userName}</span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-gray-600">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="h-4 w-4 accent-forest-700" />
            Ẩn tên trên bảng góp ý
          </label>
        </div>
      )}

      {state.error && <div className="text-[13px] font-bold text-red-600">{state.error}</div>}

      {/* Giá trị gửi kèm server action */}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="mood" value={mood} />
      <input type="hidden" name="areas" value={areas.join(",")} />
      <input type="hidden" name="anon" value={anon ? "1" : "0"} />
      <input type="hidden" name="screenshot" value={shot} />

      {loggedIn ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-sunset-500 py-3.5 text-center text-base font-extrabold text-white transition hover:bg-sunset-600 disabled:opacity-70"
        >
          {pending ? "Đang gửi…" : "Gửi góp ý"}
        </button>
      ) : (
        <Link
          href={LOGIN_HREF}
          className="rounded-full bg-sunset-500 py-3.5 text-center text-base font-extrabold text-white transition hover:bg-sunset-600"
        >
          Đăng nhập để gửi góp ý
        </Link>
      )}
    </form>
  );
}
