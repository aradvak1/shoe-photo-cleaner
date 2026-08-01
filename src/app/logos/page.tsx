"use client";

import { useEffect, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Reveal } from "@/components/motion/Reveal";
import { resizeImageFile } from "@/lib/resizeImage";
import type { Logo } from "@/types";

export default function LogosPage() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadLogos() {
    fetch("/api/logos")
      .then((res) => res.json())
      .then((data) => setLogos(data.logos ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadLogos, []);

  function resetForm() {
    setName("");
    setFile(null);
    setError(null);
  }

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

      setOpen(false);
      resetForm();
      loadLogos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setLogos((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/logos/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">לוגואים</h1>
          <p className="mt-1 text-sm text-muted">
            הלוגואים שמופיעים לבחירה בטופס בעת יצירת תמונה.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>הוספת לוגו</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">טוען…</p>
      ) : logos.length === 0 ? (
        <Card>
          <CardBody className="text-center text-sm text-muted">
            עדיין אין לוגואים. לחצו על &quot;הוספת לוגו&quot; כדי להתחיל.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {logos.map((logo, i) => (
            <Reveal key={logo.id} index={i}>
              <Card>
                <CardBody className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-sm border border-border bg-paper">
                    {logo.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo.image_url}
                        alt={logo.name}
                        className="max-h-14 max-w-14 object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted">אין תמונה</span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{logo.name}</p>
                  <button
                    onClick={() => handleDelete(logo.id)}
                    className="text-xs text-danger hover:underline"
                  >
                    מחיקה
                  </button>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="הוספת לוגו"
      >
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
    </div>
  );
}
