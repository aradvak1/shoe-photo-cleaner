"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StyleStep } from "./wizard/StyleStep";
import { PhotosStep } from "./wizard/PhotosStep";
import { CoverStep } from "./wizard/CoverStep";
import type { CatalogLook } from "@/lib/catalogLooks";
import type { CatalogStyleCategory } from "@/types";

type Step = "style" | "photos" | "cover";

const STEP_LABELS: Record<Step, string> = {
  style: "1. סגנון",
  photos: "2. עריכת תמונות",
  cover: "3. עמוד שער וסיום",
};

/**
 * Single component with internal step state rather than separate routed
 * pages — the photos step holds File objects in memory (via CreationFlow /
 * useImageCreationQueue) that can't survive a route navigation mid-batch.
 */
export function CatalogWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("style");

  const [category, setCategory] = useState<CatalogStyleCategory | null>(null);
  const [look, setLook] = useState<CatalogLook | null>(null);
  const [freeText, setFreeText] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);

  const resolvedPrompt = [look?.basePrompt, freeText.trim()].filter(Boolean).join(". ");

  return (
    <div className="space-y-6">
      <div className="flex gap-4 text-xs font-medium text-muted">
        {(Object.keys(STEP_LABELS) as Step[]).map((s) => (
          <span key={s} className={s === step ? "text-accent" : ""}>
            {STEP_LABELS[s]}
          </span>
        ))}
      </div>

      {step === "style" && (
        <StyleStep
          category={category}
          look={look}
          freeText={freeText}
          onCategoryChange={(c) => {
            setCategory(c);
            setLook(null);
          }}
          onLookChange={setLook}
          onFreeTextChange={setFreeText}
          onNext={() => setStep("photos")}
        />
      )}

      {step === "photos" && category && (
        <PhotosStep
          category={category}
          resolvedPrompt={resolvedPrompt}
          onBack={() => setStep("style")}
          onSaved={(id) => {
            setBatchId(id);
            setStep("cover");
          }}
        />
      )}

      {step === "cover" && batchId && (
        <CoverStep
          batchId={batchId}
          styleCategory={category}
          lookId={look?.id ?? null}
          resolvedPrompt={resolvedPrompt}
          onCreated={(catalogId) => router.push(`/catalog/${catalogId}`)}
        />
      )}
    </div>
  );
}
