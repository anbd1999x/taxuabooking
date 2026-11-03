"use client";

import { useState } from "react";
import { FEEDBACK_FAQS } from "@/lib/feedback";

export function Faq() {
  const [open, setOpen] = useState<number>(-1);
  return (
    <section className="mt-4 flex flex-col gap-2.5">
      <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Câu hỏi thường gặp</h2>
      {FEEDBACK_FAQS.map((f, i) => {
        const on = open === i;
        return (
          <div key={f.q} className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
            <button
              type="button"
              onClick={() => setOpen(on ? -1 : i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[15px] font-bold text-ink"
            >
              {f.q}
              <span className={`flex-none text-lg text-gray-400 transition-transform ${on ? "rotate-45" : ""}`}>+</span>
            </button>
            <div className={`grid transition-all duration-300 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm leading-relaxed text-gray-600">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
