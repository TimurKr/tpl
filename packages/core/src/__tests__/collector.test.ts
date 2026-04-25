import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFile, mkdir, rm, readFile, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { check, collect, generate } from "../collector.js";

describe("collector", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = join(tmpdir(), `tpl-collector-test-${Date.now()}`);
    await mkdir(rootDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  async function writeTemplate(relPath: string, content: string): Promise<void> {
    const full = join(rootDir, relPath);
    const dir = full.replace(/\/[^/]+$/, "");
    await mkdir(dir, { recursive: true });
    await writeFile(full, content, "utf-8");
  }

  function outputFile(): string {
    return join(rootDir, "lib/tpl.gen.ts");
  }

  describe("collect", () => {
    it("finds all .tpl.md files", async () => {
      await writeTemplate("src/a.tpl.md", "Hello {{name}}");
      await writeTemplate("src/nested/b.tpl.md", "World {{thing}}");

      const templates = await collect({ rootDir, outputFile: outputFile() });
      expect(templates).toHaveLength(2);
      const names = templates.map((t) => t.functionName).sort();
      expect(names).toEqual(["a", "b"]);
    });

    it("returns empty array when no .tpl.md files found", async () => {
      const templates = await collect({ rootDir, outputFile: outputFile() });
      expect(templates).toHaveLength(0);
    });

    it("ignores node_modules", async () => {
      await writeTemplate("src/real.tpl.md", "Real prompt");
      await writeTemplate("node_modules/pkg/fake.tpl.md", "Should be ignored");

      const templates = await collect({ rootDir, outputFile: outputFile() });
      expect(templates).toHaveLength(1);
      expect(templates[0]!.functionName).toBe("real");
    });

    it("ignores dist directory", async () => {
      await writeTemplate("src/real.tpl.md", "Real prompt");
      await writeTemplate("dist/generated.tpl.md", "Should be ignored");

      const templates = await collect({ rootDir, outputFile: outputFile() });
      expect(templates).toHaveLength(1);
    });

    it("respects custom ignore patterns", async () => {
      await writeTemplate("src/real.tpl.md", "Real prompt");
      await writeTemplate("test-fixtures/fixture.tpl.md", "Should be ignored");

      const templates = await collect({
        rootDir,
        outputFile: outputFile(),
        ignore: ["**/test-fixtures/**"],
      });
      expect(templates).toHaveLength(1);
      expect(templates[0]!.functionName).toBe("real");
    });

    it("finds .tpl.mdx, .tpl.txt, and .tpl.html files", async () => {
      await writeTemplate("src/a.tpl.mdx", "MDX prompt {{topic}}");
      await writeTemplate("src/b.tpl.txt", "Plain text prompt {{input}}");
      await writeTemplate("src/c.tpl.html", "<p>HTML prompt {{name}}</p>");

      const templates = await collect({ rootDir, outputFile: outputFile() });
      expect(templates).toHaveLength(3);
      const names = templates.map((t) => t.functionName).sort();
      expect(names).toEqual(["a", "b", "c"]);
    });

    it("parses templates correctly with VariableDef", async () => {
      await writeTemplate(
        "src/welcome.tpl.md",
        "---\ndescription: Welcome message\n---\nHello {{userName}}!"
      );

      const templates = await collect({ rootDir, outputFile: outputFile() });
      expect(templates).toHaveLength(1);
      const t = templates[0]!;
      expect(t.functionName).toBe("welcome");
      expect(t.description).toBe("Welcome message");
      expect(t.variables).toHaveLength(1);
      expect(t.variables[0]).toMatchObject({ name: "userName", type: "string", optional: false });
    });
  });

  describe("generate", () => {
    it("writes a colocated file per prompt plus a manifest", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const srcFiles = await readdir(join(rootDir, "src"));
      expect(srcFiles).toContain("greet.tpl.gen.ts");
      const manifest = await readFile(out, "utf-8");
      expect(manifest).toContain("export const prompts");
    });

    it("each prompt file imports the source .tpl.md and uses renderTemplate", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const content = await readFile(join(rootDir, "src/greet.tpl.gen.ts"), "utf-8");
      expect(content).toContain("export function buildGreetPrompt");
      expect(content).toContain("AUTO-GENERATED");
      expect(content).toContain("renderTemplate");
      expect(content).toContain(`import TEMPLATE from`);
      expect(content).toContain(`.tpl.md" with { type: "text" }`);
      expect(content).not.toContain("const TEMPLATE");
    });

    it("generates tpl.gen.env.d.ts with ambient module declaration", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const files = await readdir(join(rootDir, "lib"));
      expect(files).toContain("tpl.gen.env.d.ts");

      const dts = await readFile(join(rootDir, "lib/tpl.gen.env.d.ts"), "utf-8");
      expect(dts).toContain(`declare module "*.tpl.md"`);
    });

    it("manifest re-exports all prompts and defines prompts const with short keys", async () => {
      await writeTemplate("src/a.tpl.md", "A {{x}}");
      await writeTemplate("src/b.tpl.md", "B {{y}}");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const index = await readFile(out, "utf-8");
      expect(index).toContain(`export * from "../src/a.tpl.gen.js"`);
      expect(index).toContain(`export * from "../src/b.tpl.gen.js"`);
      expect(index).toContain("export const prompts");
      expect(index).toContain("a: buildAPrompt,");
      expect(index).toContain("b: buildBPrompt,");
    });

    it("manifest exports renderPrompt", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const index = await readFile(out, "utf-8");
      expect(index).toContain("export function renderPrompt<Name extends PromptName>(");
    });

    it("creates manifest directory if it does not exist", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      const out = join(rootDir, "deeply/nested/output/tpl.gen.ts");

      await generate({ rootDir, outputFile: out });

      const index = await readFile(out, "utf-8");
      expect(index).toContain("AUTO-GENERATED");
    });

    it("returns correct count and outputFile", async () => {
      await writeTemplate("src/a.tpl.md", "A");
      await writeTemplate("src/b.tpl.md", "B");

      const result = await generate({ rootDir, outputFile: outputFile() });

      expect(result.count).toBe(2);
      expect(result.outputFile).toBe(outputFile());
      expect(result.templates).toHaveLength(2);
    });

    it("name collision: generates a collision file instead of throwing", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      await writeTemplate("other/greet.tpl.md", "Hi");
      const out = outputFile();

      // Must NOT reject — generation continues with a collision marker
      const result = await generate({ rootDir, outputFile: out });

      const files = await readdir(join(rootDir, "src"));
      expect(files).toContain("greet.tpl.gen.ts");

      const content = await readFile(join(rootDir, "src/greet.tpl.gen.ts"), "utf-8");
      expect(content).toContain("NAME COLLISION");

      // Only one unique name, so count is 1 (deduplicated)
      expect(result.count).toBe(2); // 2 templates parsed
    });

    it("removes stale prompt files when a template is deleted", async () => {
      await writeTemplate("src/a.tpl.md", "A");
      await writeTemplate("src/b.tpl.md", "B");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });
      let files = await readdir(join(rootDir, "src"));
      expect(files).toContain("a.tpl.gen.ts");
      expect(files).toContain("b.tpl.gen.ts");

      // Remove b.tpl.md and regenerate
      await rm(join(rootDir, "src/b.tpl.md"));
      await generate({ rootDir, outputFile: out });

      files = await readdir(join(rootDir, "src"));
      expect(files).toContain("a.tpl.gen.ts");
      expect(files).not.toContain("b.tpl.gen.ts");
    });

    it("generates valid TypeScript with correct exports", async () => {
      await writeTemplate(
        "src/welcome-email.tpl.md",
        "---\ndescription: Welcome email\n---\nHello {{userName}} from {{product}}!"
      );

      const out = outputFile();
      await generate({ rootDir, outputFile: out });

      const promptFile = await readFile(join(rootDir, "src/welcome-email.tpl.gen.ts"), "utf-8");
      expect(promptFile).toContain("export interface WelcomeEmailVariables");
      expect(promptFile).toContain("export function buildWelcomeEmailPrompt");
      expect(promptFile).toContain("renderTemplate(TEMPLATE, vars)");
      expect(promptFile).toContain(`import TEMPLATE from`);
      expect(promptFile).toContain(`.tpl.md" with { type: "text" }`);
      expect(promptFile).not.toContain("const TEMPLATE");

      const index = await readFile(out, "utf-8");
      expect(index).toContain("export const prompts");
      expect(index).toContain("welcomeEmail: buildWelcomeEmailPrompt");
    });
  });

  describe("check", () => {
    it("passes when generated files are up to date", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();
      await generate({ rootDir, outputFile: out });

      const result = await check({ rootDir, outputFile: out });

      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.count).toBe(1);
    });

    it("reports missing generated files", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();

      const result = await check({ rootDir, outputFile: out });

      expect(result.ok).toBe(false);
      expect(result.issues.map((issue) => issue.kind)).toContain("missing");
      expect(result.issues.map((issue) => issue.filePath)).toContain(join(rootDir, "src/greet.tpl.gen.ts"));
      expect(result.issues.map((issue) => issue.filePath)).toContain(out);
    });

    it("reports changed generated files", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();
      await generate({ rootDir, outputFile: out });
      await writeFile(join(rootDir, "src/greet.tpl.gen.ts"), "// edited\n", "utf-8");

      const result = await check({ rootDir, outputFile: out });

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual({
        kind: "changed",
        filePath: join(rootDir, "src/greet.tpl.gen.ts"),
      });
    });

    it("reports stale generated prompt files", async () => {
      await writeTemplate("src/a.tpl.md", "A");
      await writeTemplate("src/b.tpl.md", "B");
      const out = outputFile();
      await generate({ rootDir, outputFile: out });
      await rm(join(rootDir, "src/b.tpl.md"));

      const result = await check({ rootDir, outputFile: out });

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual({
        kind: "stale",
        filePath: join(rootDir, "src/b.tpl.gen.ts"),
      });
    });
  });
});
