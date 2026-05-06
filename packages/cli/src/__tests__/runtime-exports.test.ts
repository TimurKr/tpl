import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
  exports?: Record<string, unknown>;
};

type RuntimeExport = {
  types?: string;
  import?: string;
  require?: string;
  default?: string;
};

const here = dirname(fileURLToPath(import.meta.url));

function readPackageJson(packageDirFromHere: string): PackageJson {
  return JSON.parse(
    readFileSync(join(here, packageDirFromHere, "package.json"), "utf8"),
  ) as PackageJson;
}

function runtimeExport(pkg: PackageJson): RuntimeExport {
  const runtime = pkg.exports?.["./runtime"];
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
    throw new Error(
      'Expected package.json exports["./runtime"] to be an object',
    );
  }
  return runtime as RuntimeExport;
}

describe("runtime package export", () => {
  it("supports ESM, CommonJS, types, and mixed-loader fallback in the public package", () => {
    expect(runtimeExport(readPackageJson("../.."))).toEqual({
      types: "./dist/runtime.d.ts",
      import: "./dist/runtime.js",
      require: "./dist/runtime.cjs",
      default: "./dist/runtime.js",
    });
  });

  it("keeps @tpl/core runtime export compatible with the public package", () => {
    expect(runtimeExport(readPackageJson("../../../core"))).toEqual({
      types: "./dist/runtime.d.ts",
      import: "./dist/runtime.js",
      require: "./dist/runtime.cjs",
      default: "./dist/runtime.js",
    });
  });
});
