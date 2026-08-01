// Vercel rejects request bodies above ~4.5MB at the platform layer (before
// any route code runs) — confirmed directly: a 2.5MB upload succeeds, a
// 6.3MB one 413s immediately. Real phone-camera photos routinely exceed
// that, so every upload needs to be shrunk client-side first; there's no
// server-side fix possible since the request never reaches our code.
export async function resizeImageFile(
  file: File,
  {
    maxDimension = 2000,
    quality = 0.85,
    skipBelowBytes = 3 * 1024 * 1024,
  }: { maxDimension?: number; quality?: number; skipBelowBytes?: number } = {}
): Promise<File> {
  if (file.size <= skipBelowBytes) return file;

  // createImageBitmap applies EXIF orientation automatically, so this also
  // fixes sideways/upside-down phone photos as a side effect.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
