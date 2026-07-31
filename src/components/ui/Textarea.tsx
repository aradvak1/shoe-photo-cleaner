import type { TextareaHTMLAttributes } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  caption?: string;
}

export function Textarea({ label, caption, className = "", id, ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`rounded-sm border border-border bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent ${className}`}
        {...rest}
      />
      {caption && <p className="text-xs text-muted">{caption}</p>}
    </div>
  );
}
