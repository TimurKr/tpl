import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOptions, findProjectRoot, readConfig } from "../config.js";

function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    `tpl-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("findProjectRoot", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns the directory containing package.json", () => {
    writeFileSync(join(tempDir, "package.json"), "{}");
    expect(findProjectRoot(tempDir)).toBe(tempDir);
  });

  it("walks up to find package.json", () => {
    writeFileSync(join(tempDir, "package.json"), "{}");
    const nested = join(tempDir, "src", "features", "auth");
    mkdirSync(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(tempDir);
  });

  it("throws when no package.json found", () => {
    // Use a deeply nested temp dir with no package.json anywhere in its custom subtree
    // We can't guarantee /tmp has no package.json walking all the way to root, but
    // we can check the error is thrown for a path that truly has none.
    // Skip this test if the temp dir somehow inherits a package.json.
    expect(() => findProjectRoot("/")).toThrow("Could not find a package.json");
  });
});

describe("readConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty config when no tpl key in package.json", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test" }),
    );
    expect(readConfig(tempDir)).toEqual({});
  });

  it("returns tpl config from package.json", () => {
    const config = {
      output: "generated/tpl.ts",
      typesOutput: "generated/tpl.d.ts",
      pattern: "prompts/**/*.tpl.md",
      namespaceAliases: { "src/app": "", _prompts: "" },
    };
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test", tpl: config }),
    );
    expect(readConfig(tempDir)).toEqual(config);
  });

  it("ignores tpl key if it's not an object", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test", tpl: "invalid" }),
    );
    expect(readConfig(tempDir)).toEqual({});
  });

  it("ignores tpl key if it's an array", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test", tpl: [] }),
    );
    expect(readConfig(tempDir)).toEqual({});
  });
});

describe("buildOptions", () => {
  it("uses defaults when config is empty", () => {
    const opts = buildOptions("/project", {});
    expect(opts.rootDir).toBe("/project");
    expect(opts.outputFile).toBe("/project/lib/tpl.gen.ts");
    expect(opts.typesOutputFile).toBe("/project/lib/tpl.d.ts");
    expect(opts.pattern).toBe("**/*.tpl.{md,mdx,txt,html}");
    expect(opts.ignore).toEqual([]);
    expect(opts.namespaceAliases).toEqual({});
  });

  it("uses custom output from config", () => {
    const opts = buildOptions("/project", {
      output: "generated/prompts.gen.ts",
    });
    expect(opts.outputFile).toBe("/project/generated/prompts.gen.ts");
    expect(opts.typesOutputFile).toBe("/project/generated/tpl.d.ts");
  });

  it("uses custom typesOutput from config", () => {
    const opts = buildOptions("/project", {
      typesOutput: "generated/tpl.d.ts",
    });
    expect(opts.typesOutputFile).toBe("/project/generated/tpl.d.ts");
  });

  it("uses custom pattern from config", () => {
    const opts = buildOptions("/project", { pattern: "prompts/**/*.tpl.md" });
    expect(opts.pattern).toBe("prompts/**/*.tpl.md");
  });

  it("uses custom ignore from config", () => {
    const opts = buildOptions("/project", { ignore: ["vendor/**"] });
    expect(opts.ignore).toEqual(["vendor/**"]);
  });

  it("uses custom namespaceAliases from config", () => {
    const opts = buildOptions("/project", {
      namespaceAliases: { "src/app": "", _prompts: "" },
    });
    expect(opts.namespaceAliases).toEqual({
      "src/app": "",
      _prompts: "",
    });
  });

  it("passes through generation options", () => {
    const opts = buildOptions("/project", {
      importSpecifierExtension: "ts",
      templateSource: "filesystem",
      templateImportAttributeType: "raw",
      postprocess: "./scripts/tpl-postprocess.mjs",
    });
    expect(opts.importSpecifierExtension).toBe("ts");
    expect(opts.templateSource).toBe("filesystem");
    expect(opts.templateImportAttributeType).toBe("raw");
    expect(opts.postprocess).toBe("./scripts/tpl-postprocess.mjs");
  });
});
