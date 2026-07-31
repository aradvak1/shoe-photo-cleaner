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

const cellInput =
  "rounded-sm border border-border bg-card px-2 py-1 text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50";

/** Compact per-row metadata inputs, sized for use inside the results table. */
export function PhotoMetadataFields({
  values,
  onChange,
  logos,
  disabled,
  onLogoAdded,
}: {
  values: RowMetadataValues;
  onChange: (patch: Partial<RowMetadataValues>) => void;
  logos: Logo[];
  disabled?: boolean;
  onLogoAdded?: (logo: Logo) => void;
}) {
  return (
    <>
      <td className="px-3 py-2">
        <input
          value={values.modelNumber}
          onChange={(e) => onChange({ modelNumber: e.target.value })}
          className={`w-28 ${cellInput}`}
          placeholder="מספר דגם"
          disabled={disabled}
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={values.sku}
          onChange={(e) => onChange({ sku: e.target.value })}
          className={`w-24 ${cellInput}`}
          placeholder="מק״ט"
          disabled={disabled}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={values.price}
          onChange={(e) => onChange({ price: e.target.value })}
          className={`w-20 ${cellInput}`}
          placeholder="₪"
          disabled={disabled}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
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
      </td>
      <td className="px-3 py-2">
        <input
          value={values.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className={`w-20 ${cellInput}`}
          placeholder="צבע"
          disabled={disabled}
        />
      </td>
      <td className="px-3 py-2">
        <LogoSelect
          logos={logos}
          value={values.logoId}
          onChange={(v) => onChange({ logoId: v })}
          className={`w-32 ${cellInput}`}
          onLogoAdded={onLogoAdded}
        />
      </td>
    </>
  );
}
