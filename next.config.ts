import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The catalog PDF route spawns a pre-bundled worker
  // (src/lib/pdf/renderWorker.bundle.cjs, built by
  // scripts/build-pdf-worker.mjs) as an isolated child process per render
  // — see renderWorker.ts's doc comment for why. Next's default file
  // tracing only follows static `import`s, so the bundle, its font asset,
  // and the npm packages it requires at runtime (esbuild bundled with
  // `packages: "external"`, so @react-pdf/renderer -> fontkit ->
  // restructure/yoga-layout/etc. stay real requires) must be explicitly
  // included or they won't exist in the deployed function.
  outputFileTracingIncludes: {
    "/api/catalogs": [
      "./src/lib/pdf/renderWorker.bundle.cjs",
      "./src/lib/pdf/fonts/*.ttf",
      "./node_modules/**",
    ],
    // burnProductText() (src/lib/composite.ts) passes this font to sharp's
    // native text renderer via a plain filesystem path (`fontfile`), not a
    // static import, so it needs the same explicit tracing include.
    "/api/apply-text-overlay": ["./src/lib/pdf/fonts/*.ttf"],
  },
};

export default nextConfig;
