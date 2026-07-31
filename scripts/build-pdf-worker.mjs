import * as esbuild from "esbuild";
import path from "node:path";

// Pre-bundles the catalog PDF render worker to a single plain-CJS file at
// build time. generateCatalogPdf.ts spawns this as a fresh child process
// per render (see renderWorker.ts's doc comment for why in-process/tsx
// runtime transform proved unreliable on Vercel's Linux runtime).
await esbuild.build({
  entryPoints: [path.join(process.cwd(), "src/lib/pdf/renderWorker.ts")],
  outfile: path.join(process.cwd(), "src/lib/pdf/renderWorker.bundle.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  packages: "external", // node_modules resolved at runtime, same as before
  logLevel: "info",
});
