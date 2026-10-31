import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "danger" | "muted" | "info";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-forest-100 text-forest-700 ring-forest-200",
  warn: "bg-amber-100 text-amber-700 ring-amber-200",
  danger: "bg-red-100 text-red-700 ring-red-200",
  muted: "bg-gray-100 text-gray-600 ring-gray-200",
  info: "bg-sky-100 text-sky-700 ring-sky-200",
};

export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
