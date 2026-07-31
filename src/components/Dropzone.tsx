"use client";

import { useCallback, useRef, useState } from "react";

export function Dropzone({
  multiple = false,
  onFiles,
  label,
}: {
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) onFiles(multiple ? files : [files[0]]);
    },
    [multiple, onFiles]
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
        isDragOver
          ? "border-accent bg-accent-soft"
          : "border-border bg-card hover:border-border-strong"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-sm text-ink">{label}</p>
      <p className="mt-1 text-xs text-muted">גרירה לכאן או לחיצה לבחירת קובץ</p>
    </div>
  );
}
