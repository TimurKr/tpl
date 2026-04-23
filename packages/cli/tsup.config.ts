import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // CJS for the binary — avoids CJS-in-ESM issues with gray-matter/chokidar
  // when bundling @tpl/core transitively. The binary doesn't need to be ESM.
  format: ["cjs"],
  platform: "node",
  dts: false,
  sourcemap: true,
  clean: true,
  // Bundle @tpl/core so the published package is fully self-contained.
  noExternal: ["@tpl/core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
