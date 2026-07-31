import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "danger" | "pending";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-paper text-muted border-border",
  success: "bg-success-bg text-success border-success/30",
  danger: "bg-danger-bg text-danger border-danger/30",
  pending: "bg-paper text-muted border-border animate-pulse",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
