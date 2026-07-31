import type { SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = "", id, children, ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`rounded-sm border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
