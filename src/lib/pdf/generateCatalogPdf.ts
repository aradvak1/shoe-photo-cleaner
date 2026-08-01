import { spawn } from "node:child_process";
import path from "node:path";
import { CATALOG_TEMPLATES } from "./templates";
import type { CatalogCoverData, CatalogPhotoEntry } from "./templates/types";

/**
 * Renders a catalog PDF in an isolated child process — see renderWorker.ts
 * for why in-process rendering is unsafe (unresolved @react-pdf/textkit
 * bug corrupting state across renders in a long-lived process).
 */
export async function generateCatalogPdf(
  templateSlug: string,
  catalogName: string,
  photos: CatalogPhotoEntry[],
  cover?: CatalogCoverData
): Promise<Buffer> {
  if (!CATALOG_TEMPLATES[templateSlug]) {
    throw new Error(`Unknown catalog template: ${templateSlug}`);
  }

  const workerPath = path.join(process.cwd(), "src/lib/pdf/renderWorker.bundle.cjs");
  const input = JSON.stringify({
    templateSlug,
    catalogName,
    photos: photos.map((p) => ({
      imageData: p.imageData.toString("base64"),
      logoData: p.logoData ? p.logoData.toString("base64") : null,
      modelNumber: p.modelNumber,
      price: p.price,
      logoName: p.logoName,
      sizeMin: p.sizeMin,
      sizeMax: p.sizeMax,
    })),
    cover: cover
      ? {
          title: cover.title,
          subtitle: cover.subtitle,
          extraText: cover.extraText,
          logoData: cover.logoData ? cover.logoData.toString("base64") : null,
        }
      : null,
  });

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", reject);
    // Swallow EPIPE if the child exits before/while we're still writing to
    // its stdin (e.g. it crashes on startup) — otherwise this is an
    // uncaught exception that takes down the whole server process.
    child.stdin.on("error", () => {});
    child.on("close", (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`PDF render worker exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(`PDF render worker error: ${result.error}`));
          return;
        }
        resolve(Buffer.from(result.pdf, "base64"));
      } catch {
        reject(new Error(`PDF render worker returned invalid output: ${stderr || stdout}`));
      }
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}
