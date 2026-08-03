/**
 * The HTML `download` attribute is ignored by browsers for cross-origin
 * URLs (e.g. Supabase storage links) — clicking such a link just navigates
 * to the resource instead of saving it. Fetching as a blob first forces a
 * real download regardless of origin.
 */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
