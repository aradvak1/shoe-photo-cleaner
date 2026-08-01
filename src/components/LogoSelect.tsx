"use client";

import { useEffect, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { resizeImageFile } from "@/lib/resizeImage";
import type { Logo } from "@/types";

export function useLogos() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logos")
      .then((res) => res.json())
      .then((data) => setLogos(data.logos ?? []))
      .finally(() => setLoading(false));
  }, []);

  return { logos, loading, setLogos };
}

export function LogoSelect({
  logos,
  value,
  onChange,
  className,
  onLogoAdded,
}: {
  logos: Logo[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** When provided, shows a "+ לוגו חדש" quick-add button next to the select. */
  onLogoAdded?: (logo: Logo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) {
      setError("יש להזין שם ללוגו");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let imageUrl: string | null = null;
      if (file) {
        const uploadFile = await resizeImageFile(file);
        const formData = new FormData();
        formData.append("image", uploadFile);
        const uploadRes = await fetch("/api/logos/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "העלאת הקובץ נכשלה");
        imageUrl = uploadData.url;
      }

      const res = await fetch("/api/logos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), image_url: imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שמירת הלוגו נכשלה");

      onLogoAdded?.(data.logo);
      onChange(data.logo.id);
      setOpen(false);
      setName("");
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ??
          "w-full rounded border border-border bg-card px-2 py-1.5 text-sm text-ink"
        }
      >
        <option value="">ללא לוגו</option>
        {logos.map((logo) => (
          <option key={logo.id} value={logo.id}>
            {logo.name}
          </option>
        ))}
      </select>

      {onLogoAdded && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="הוספת לוגו חדש"
            className="shrink-0 rounded-sm border border-border px-1.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent active:scale-95"
          >
            + לוגו
          </button>

          <Dialog open={open} onClose={() => setOpen(false)} title="הוספת לוגו חדש">
            <div className="space-y-4">
              <Input
                label="שם הלוגו"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: המותג שלנו"
              />
              <Dropzone
                label={file ? file.name : "גררו קובץ לוגו (לא חובה)"}
                onFiles={(files) => setFile(files[0] ?? null)}
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <Button onClick={handleAdd} disabled={saving} className="w-full">
                {saving ? "שומר…" : "שמירה"}
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
}
