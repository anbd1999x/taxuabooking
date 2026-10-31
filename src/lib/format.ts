import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal | number | string | null | undefined;

/** Định dạng tiền VND: 250000 -> "250.000đ". null/undefined -> "Liên hệ". */
export function formatPrice(value: Money, fallback = "Liên hệ"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(n)) return fallback;
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

/** Chuyển Decimal/null sang number|null để truyền qua Client Component. */
export function toNumber(value: Money): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isNaN(n) ? null : n;
}

const DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const WEEKDAY_FMT = new Intl.DateTimeFormat("vi-VN", { weekday: "long" });

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return DATE_FMT.format(d);
}

export function formatWeekday(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return WEEKDAY_FMT.format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d) +
    " " +
    DATE_FMT.format(d)
  );
}
