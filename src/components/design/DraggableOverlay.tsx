"use client";

import type { ReactNode } from "react";
import { FIELD_LABELS, TEXT_FIELD_KEYS } from "@/hooks/useDragResizeLayout";
import type { DraggableField, TextFieldKey } from "@/hooks/useDragResizeLayout";
import type { TemplateLogoField, TemplateTextField } from "@/lib/photoTemplate";

/**
 * Presentational drag handles for a logo box + text-field pills, positioned
 * by fraction-of-container coordinates (percent left/top/width/height) —
 * the caller must render this inside a `position: relative` element with
 * no padding, whose ref is the same one passed to useDragResizeLayout, so
 * these percentages and the drag math agree on the same box. Renders no
 * background of its own (no wrapping div) — sits as absolutely-positioned
 * siblings alongside whatever background the caller renders (a blank white
 * canvas for the standalone template builder, or a live photo `<img>` for
 * the per-photo design canvas).
 */
export function DraggableOverlay({
  logo,
  textFields,
  onBeginDrag,
  logoContent = FIELD_LABELS.logo,
  textFieldContent,
}: {
  logo?: TemplateLogoField;
  textFields: Partial<Record<TextFieldKey, TemplateTextField>>;
  onBeginDrag: (field: DraggableField, e: React.PointerEvent) => void;
  /** Content shown in the small tag above the logo box — defaults to the label "לוגו". */
  logoContent?: ReactNode;
  /** Content shown inside each text field's pill — defaults to just the field's label (e.g. "דגם"). The standalone builder overrides this to also show a placeholder value ("דגם : 1234") since there's no real photo underneath to preview against. */
  textFieldContent?: (field: TextFieldKey, value: TemplateTextField) => ReactNode;
}) {
  return (
    <>
      {logo && (
        <div
          onPointerDown={(e) => onBeginDrag("logo", e)}
          title="גררו כדי להזיז את הלוגו"
          className="absolute cursor-move rounded-sm border-2 border-dashed border-accent/80 bg-accent/10 hover:bg-accent/20"
          style={{
            left: `${logo.leftFraction * 100}%`,
            top: `${logo.topFraction * 100}%`,
            width: `${logo.widthFraction * 100}%`,
            height: `${logo.heightFraction * 100}%`,
          }}
        >
          <span className="absolute -top-5 right-0 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] text-[#1c1108]">
            {logoContent}
          </span>
        </div>
      )}
      {TEXT_FIELD_KEYS.filter((f) => textFields[f]).map((field) => {
        const value = textFields[field]!;
        return (
          <div
            key={field}
            onPointerDown={(e) => onBeginDrag(field, e)}
            title="גררו כדי להזיז"
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border border-accent bg-ink/80 px-2 py-0.5 text-[10px] whitespace-nowrap text-white hover:bg-ink"
            style={{ left: `${value.centerXFraction * 100}%`, top: `${value.centerYFraction * 100}%` }}
          >
            {textFieldContent ? textFieldContent(field, value) : FIELD_LABELS[field]}
          </div>
        );
      })}
    </>
  );
}
