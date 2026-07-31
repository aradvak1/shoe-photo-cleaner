/**
 * Standalone PDF-render worker, spawned as a fresh child process per
 * catalog generation by generateCatalogPdf() (running the compiled
 * renderWorker.bundle.cjs — see scripts/build-pdf-worker.mjs).
 *
 * Why a subprocess at all: @react-pdf/textkit has an unresolved upstream
 * bug where its RTL bidi-reordering step (reorderLine) throws "Cannot
 * read properties of undefined (reading 'id')" on the 2nd+ render sharing
 * a long-lived Node process — reproduced consistently in this app, and
 * confirmed as a known open issue (diegomura/react-pdf#3292:
 * "restarting the application resolves it temporarily"). Vercel Fluid
 * Compute reuses warm instances across requests, so in-process rendering
 * would eventually corrupt state and fail unpredictably. Running each
 * render in its own fresh process sidesteps the bug entirely.
 *
 * Why pre-bundled (not run as raw .ts via a runtime loader like tsx):
 * running it via `node --import tsx` worked locally but crashed only on
 * Vercel's Linux runtime with a different error ("Cannot read properties
 * of null (reading 'props')" inside @react-pdf's own reconciler) —
 * pre-compiling to plain CJS removes that loader from the equation and
 * fixed it.
 *
 * Protocol: reads one JSON line from stdin (photos with imageData/logoData
 * base64-encoded), writes one JSON line to stdout: { pdf: base64 } or
 * { error: string }.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { registerCatalogFonts } from "./fonts";
import { CATALOG_TEMPLATES } from "./templates";
import type { CatalogPhotoEntry } from "./templates/types";

interface WorkerInput {
  templateSlug: string;
  catalogName: string;
  photos: Array<{
    imageData: string;
    logoData: string | null;
    modelNumber: string | null;
    price: number | null;
    logoName: string | null;
    sizeMin: number | null;
    sizeMax: number | null;
  }>;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  const input: WorkerInput = JSON.parse(raw);

  const template = CATALOG_TEMPLATES[input.templateSlug];
  if (!template) {
    process.stdout.write(JSON.stringify({ error: `Unknown template: ${input.templateSlug}` }));
    process.exit(1);
  }

  registerCatalogFonts();

  const photos: CatalogPhotoEntry[] = input.photos.map((p) => ({
    imageData: Buffer.from(p.imageData, "base64"),
    logoData: p.logoData ? Buffer.from(p.logoData, "base64") : null,
    modelNumber: p.modelNumber,
    price: p.price,
    logoName: p.logoName,
    sizeMin: p.sizeMin,
    sizeMax: p.sizeMax,
  }));

  const element = React.createElement(template.component, {
    catalogName: input.catalogName,
    photos,
  }) as Parameters<typeof renderToBuffer>[0];

  const buffer = await renderToBuffer(element);
  process.stdout.write(JSON.stringify({ pdf: buffer.toString("base64") }));
}

main().catch((err) => {
  const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  process.stdout.write(JSON.stringify({ error: message }));
  process.exit(1);
});
