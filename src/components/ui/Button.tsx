import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-forest-600 text-white hover:bg-forest-700 focus-visible:outline-forest-600 shadow-sm",
  accent:
    "bg-sunset-500 text-white hover:bg-sunset-600 focus-visible:outline-sunset-500 shadow-sm",
  outline:
    "border border-forest-300 text-forest-700 hover:bg-forest-50 focus-visible:outline-forest-600",
  ghost: "text-forest-700 hover:bg-forest-50 focus-visible:outline-forest-600",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(BASE, VARIANT[variant], SIZE[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: CommonProps & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
