import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    /** Dependency-free template renderer (no fast-glob / collector). */
    runtime: "src/runtime.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});
