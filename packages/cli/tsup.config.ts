import { defineConfig } from "tsup";

export default defineConfig([
  // Binary entry — CJS so the shebang works universally
  {
    entry: { index: "src/index.ts" },
    format: ["cjs"],
    platform: "node",
    dts: false,
    sourcemap: true,
    clean: true,
    // Bundle @tpl/core so the published binary is fully self-contained.
    noExternal: ["@tpl/core"],
    banner: { js: "#!/usr/bin/env node" },
  },
  // Runtime entry — dual-format library imported by generated prompt files.
  // Bundle only @tpl/core/runtime so fast-glob and other generator deps never
  // enter app/browser bundles (see packages/core package.json "exports").
  {
    entry: { runtime: "src/runtime.ts" },
    format: ["esm", "cjs"],
    platform: "neutral",
    dts: true,
    sourcemap: true,
    clean: false,
    noExternal: ["@tpl/core/runtime"],
  },
]);
