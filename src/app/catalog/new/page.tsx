import { Suspense } from "react";
import { CatalogBuilder } from "@/components/catalog/CatalogBuilder";

export default function CatalogNewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">טוען…</p>}>
      <CatalogBuilder />
    </Suspense>
  );
}
