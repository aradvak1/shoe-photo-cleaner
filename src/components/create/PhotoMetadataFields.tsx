"use client";

import { useState } from "react";
import { LogoSelect } from "@/components/LogoSelect";
import type { Logo } from "@/types";

export interface RowMetadataValues {
  modelNumber: string;
  sku: string;
  price: string;
  logoId: string;
  sizeMin: string;
  sizeMax: string;
  color: string;
}

type FieldKey = "modelNumber" | "sku" | "price" | "sizes" | "color" | "logo";

const FIELD_ORDER: FieldKey[] = ["modelNumber", "sku", "price", "sizes", "color", "logo"];

const FIELD_LABELS: Record<FieldKey, string> = {
  modelNumber: "דגם",
  sku: "מק״ט",
  price: "מחיר",
  sizes: "מידות",
  color: "צבע",
  logo: "לוגו",
};

function isFieldActive(key: FieldKey, values: RowMetadataValues): boolean {
  switch (key) {
    case "modelNumber":
      return values.modelNumber !== "";
    case "sku":
      return values.sku !== "";
    case "price":
      return values.price !== "";
    case "sizes":
      return values.sizeMin !== "" || values.sizeMax !== "";
    case "color":
      return values.color !== "";
    case "logo":
      return values.logoId !== "";
  }
}

const cellInput =
  "rounded-sm border border-border bg-card px-2 py-1 text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50";

/**
 * Per-row field picker: click a chip to turn a field "on" and reveal its
 * input; only toggled-on fields end up filled in (and, when burn-text is
 * on, burned together onto the one saved photo). Container-agnostic (plain
 * div) so it can be reused both inside the creation-flow table (via
 * PhotoMetadataFields below) and in the standalone presets management form.
 */
export function MetadataFieldPicker({
  values,
  onChange,
  logos,
  disabled,
  onLogoAdded,
  burnsPrice = false,
}: {
  values: RowMetadataValues;
  onChange: (patch: Partial<RowMetadataValues>) => void;
  logos: Logo[];
  disabled?: boolean;
  onLogoAdded?: (logo: Logo) => void;
  /** True when a fixed template with a price slot is active — otherwise price never gets burned onto the photo. */
  burnsPrice?: boolean;
}) {
  // Fields with a value are always "open" (derived from live values, so
  // externally-set values — a default logo backfill, an applied preset —
  // show up correctly with no extra wiring). This set adds fields the user
  // just clicked open but hasn't typed into yet.
  const [manuallyOpened, setManuallyOpened] = useState<Set<FieldKey>>(new Set());

  const openFields = new Set<FieldKey>([
    ...FIELD_ORDER.filter((key) => isFieldActive(key, values)),
    ...manuallyOpened,
  ]);

  function toggleField(key: FieldKey) {
    if (openFields.has(key)) {
      setManuallyOpened((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      if (key === "sizes") onChange({ sizeMin: "", sizeMax: "" });
      else if (key === "logo") onChange({ logoId: "" });
      else onChange({ [key]: "" } as Partial<RowMetadataValues>);
    } else {
      setManuallyOpened((prev) => new Set(prev).add(key));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {FIELD_ORDER.map((key) => {
          const active = openFields.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleField(key)}
              disabled={disabled}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-muted hover:border-border-strong"
              }`}
            >
              {active ? "✓ " : "+ "}
              {FIELD_LABELS[key]}
            </button>
          );
        })}
      </div>

      {openFields.size > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {openFields.has("modelNumber") && (
            <input
              autoFocus
              value={values.modelNumber}
              onChange={(e) => onChange({ modelNumber: e.target.value })}
              className={`w-24 ${cellInput}`}
              placeholder="מספר דגם"
              disabled={disabled}
            />
          )}
          {openFields.has("sku") && (
            <input
              autoFocus
              value={values.sku}
              onChange={(e) => onChange({ sku: e.target.value })}
              className={`w-20 ${cellInput}`}
              placeholder="מק״ט"
              disabled={disabled}
            />
          )}
          {openFields.has("price") && (
            <input
              autoFocus
              type="number"
              value={values.price}
              onChange={(e) => onChange({ price: e.target.value })}
              className={`w-16 ${cellInput}`}
              placeholder="₪"
              disabled={disabled}
            />
          )}
          {openFields.has("sizes") && (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                value={values.sizeMin}
                onChange={(e) => onChange({ sizeMin: e.target.value })}
                className={`w-14 ${cellInput}`}
                placeholder="מ-"
                disabled={disabled}
              />
              <span className="text-muted">-</span>
              <input
                type="number"
                value={values.sizeMax}
                onChange={(e) => onChange({ sizeMax: e.target.value })}
                className={`w-14 ${cellInput}`}
                placeholder="עד"
                disabled={disabled}
              />
            </div>
          )}
          {openFields.has("color") && (
            <input
              autoFocus
              value={values.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className={`w-20 ${cellInput}`}
              placeholder="צבע"
              disabled={disabled}
            />
          )}
          {openFields.has("logo") && (
            <LogoSelect
              logos={logos}
              value={values.logoId}
              onChange={(v) => onChange({ logoId: v })}
              className={`w-32 ${cellInput}`}
              onLogoAdded={onLogoAdded}
            />
          )}
        </div>
      )}

      {openFields.has("price") && (
        <p className="mt-1 text-[10px] text-muted">
          {burnsPrice
            ? "המחיר יופיע על התמונה במיקום שנקבע בתבנית."
            : "מחיר משמש לגלריה ולקטלוג בלבד — לא נצרב על התמונה (בחרו תבנית תמונה כדי לצרוב גם מחיר)."}
        </p>
      )}
    </div>
  );
}

/**
 * Table-row wrapper around MetadataFieldPicker — used by the creation-flow
 * table, which needs each row's picker inside its own <td>.
 */
export function PhotoMetadataFields(
  props: Parameters<typeof MetadataFieldPicker>[0]
) {
  return (
    <td className="px-3 py-2">
      <MetadataFieldPicker {...props} />
    </td>
  );
}
