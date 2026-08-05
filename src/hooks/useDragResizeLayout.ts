"use client";

import type { RefObject } from "react";
import type { TemplateLogoField, TemplateTextField } from "@/lib/photoTemplate";

export type DraggableField = "logo" | "modelNumber" | "price" | "sizes" | "color";
export type TextFieldKey = Exclude<DraggableField, "logo">;

export const FIELD_LABELS: Record<DraggableField, string> = {
  logo: "לוגו",
  modelNumber: "דגם",
  price: "מחיר",
  sizes: "מידות",
  color: "צבע",
};

export const TEXT_FIELD_KEYS: TextFieldKey[] = ["modelNumber", "price", "sizes", "color"];

/**
 * Drag-to-move + slider-to-resize logic for a logo box and text-field
 * positions, factored out of what used to be near-duplicate implementations
 * in the standalone template builder (a from-scratch draft layout on a
 * blank canvas) and the per-photo design canvas (a template's fractions
 * merged with a specific photo's customLayout overrides) — the math is
 * identical, only where the "current value" comes from and where a new
 * value gets committed differs, which this hook takes as callbacks.
 *
 * Listeners are attached imperatively, directly inside the pointerdown
 * handler that starts the drag — not via a useEffect keyed on drag state.
 * An effect-based attach/detach cycle is one render behind the state
 * change that triggers it, and under dev StrictMode's double-invoke that
 * window can leave two listeners attached at once; attaching directly here
 * removes that whole class of timing bug (found and fixed earlier when
 * this logic first shipped).
 */
export function useDragResizeLayout({
  containerRef,
  getFieldValue,
  getReferenceField,
  setField,
}: {
  containerRef: RefObject<HTMLElement | null>;
  /** Current value for a field — an already-merged effective layout for the per-photo canvas, or a draft layout for the standalone builder. */
  getFieldValue: (field: DraggableField) => TemplateLogoField | TemplateTextField | undefined;
  /** The field's "100%" reference (a template's own base fractions, or a fixed DEFAULT_* constant) — scale sliders and logo aspect ratio are computed from this, not from the current value, so repeated resizing never compounds rounding drift. */
  getReferenceField: (field: DraggableField) => TemplateLogoField | TemplateTextField | undefined;
  /** Commits a new value for a field — caller decides where it's stored. */
  setField: (field: DraggableField, value: TemplateLogoField | TemplateTextField) => void;
}) {
  function beginDrag(field: DraggableField, e: React.PointerEvent) {
    if (!containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const rectWidth = rect.width;
    const rectHeight = rect.height;
    const base = getFieldValue(field);
    if (!base) return;

    function clamp(value: number, min: number, max: number) {
      return Math.min(max, Math.max(min, value));
    }
    function onMove(ev: PointerEvent) {
      const dxFrac = (ev.clientX - startX) / rectWidth;
      const dyFrac = (ev.clientY - startY) / rectHeight;
      if (field === "logo") {
        const logoBase = base as TemplateLogoField;
        setField(field, {
          ...logoBase,
          leftFraction: clamp(logoBase.leftFraction + dxFrac, 0, 1 - logoBase.widthFraction),
          topFraction: clamp(logoBase.topFraction + dyFrac, 0, 1 - logoBase.heightFraction),
        });
      } else {
        const fieldBase = base as TemplateTextField;
        setField(field, {
          ...fieldBase,
          centerXFraction: clamp(fieldBase.centerXFraction + dxFrac, 0, 1),
          centerYFraction: clamp(fieldBase.centerYFraction + dyFrac, 0, 1),
        });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function setLogoScale(percent: number) {
    const current = getFieldValue("logo") as TemplateLogoField | undefined;
    const ref = getReferenceField("logo") as TemplateLogoField | undefined;
    if (!current || !ref) return;
    const factor = percent / 100;
    const newWidth = ref.widthFraction * factor;
    const newHeight = ref.heightFraction * factor;
    const centerX = current.leftFraction + current.widthFraction / 2;
    const centerY = current.topFraction + current.heightFraction / 2;
    setField("logo", {
      leftFraction: centerX - newWidth / 2,
      topFraction: centerY - newHeight / 2,
      widthFraction: newWidth,
      heightFraction: newHeight,
    });
  }

  function setFieldScale(field: TextFieldKey, percent: number) {
    const current = getFieldValue(field) as TemplateTextField | undefined;
    const ref = getReferenceField(field) as TemplateTextField | undefined;
    if (!current || !ref) return;
    const factor = percent / 100;
    setField(field, { ...current, fontSizeFraction: ref.fontSizeFraction * factor });
  }

  return { beginDrag, setLogoScale, setFieldScale };
}
