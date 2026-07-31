import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  caption?: string;
}

export function Input({ label, error, caption, className = "", id, ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`rounded-sm border border-border bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent ${
          error ? "border-danger focus:border-danger focus:ring-danger" : ""
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : caption ? (
        <p className="text-xs text-muted">{caption}</p>
      ) : null}
    </div>
  );
}
