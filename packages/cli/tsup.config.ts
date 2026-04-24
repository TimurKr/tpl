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
  // Runtime entry — ESM library imported by generated prompt files
  {
    entry: { runtime: "src/runtime.ts" },
    format: ["esm"],
    platform: "node",
    dts: true,
    sourcemap: true,
    clean: false,
    noExternal: ["@tpl/core"],
  },
]);
