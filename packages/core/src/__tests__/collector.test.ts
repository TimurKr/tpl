import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFile, mkdir, rm, readFile, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { collect, generate } from "../collector.js";

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

  function outputDir(): string {
    return join(rootDir, "lib/tpl");
  }

  describe("collect", () => {
    it("finds all .tpl.md files", async () => {
      await writeTemplate("src/a.tpl.md", "Hello {{name}}");
      await writeTemplate("src/nested/b.tpl.md", "World {{thing}}");

      const templates = await collect({ rootDir, outputDir: outputDir() });
      expect(templates).toHaveLength(2);
      const names = templates.map((t) => t.functionName).sort();
      expect(names).toEqual(["a", "b"]);
    });

    it("returns empty array when no .tpl.md files found", async () => {
      const templates = await collect({ rootDir, outputDir: outputDir() });
      expect(templates).toHaveLength(0);
    });

    it("ignores node_modules", async () => {
      await writeTemplate("src/real.tpl.md", "Real prompt");
      await writeTemplate("node_modules/pkg/fake.tpl.md", "Should be ignored");

      const templates = await collect({ rootDir, outputDir: outputDir() });
      expect(templates).toHaveLength(1);
      expect(templates[0]!.functionName).toBe("real");
    });

    it("ignores dist directory", async () => {
      await writeTemplate("src/real.tpl.md", "Real prompt");
      await writeTemplate("dist/generated.tpl.md", "Should be ignored");

      const templates = await collect({ rootDir, outputDir: outputDir() });
      expect(templates).toHaveLength(1);
    });

    it("respects custom ignore patterns", async () => {
      await writeTemplate("src/real.tpl.md", "Real prompt");
      await writeTemplate("test-fixtures/fixture.tpl.md", "Should be ignored");

      const templates = await collect({
        rootDir,
        outputDir: outputDir(),
        ignore: ["**/test-fixtures/**"],
      });
      expect(templates).toHaveLength(1);
      expect(templates[0]!.functionName).toBe("real");
    });

    it("finds .tpl.mdx, .tpl.txt, and .tpl.html files", async () => {
      await writeTemplate("src/a.tpl.mdx", "MDX prompt {{topic}}");
      await writeTemplate("src/b.tpl.txt", "Plain text prompt {{input}}");
      await writeTemplate("src/c.tpl.html", "<p>HTML prompt {{name}}</p>");

      const templates = await collect({ rootDir, outputDir: outputDir() });
      expect(templates).toHaveLength(3);
      const names = templates.map((t) => t.functionName).sort();
      expect(names).toEqual(["a", "b", "c"]);
    });

    it("parses templates correctly", async () => {
      await writeTemplate(
        "src/welcome.tpl.md",
        "---\ndescription: Welcome message\n---\nHello {{userName}}!"
      );

      const templates = await collect({ rootDir, outputDir: outputDir() });
      expect(templates).toHaveLength(1);
      const t = templates[0]!;
      expect(t.functionName).toBe("welcome");
      expect(t.description).toBe("Welcome message");
      expect(t.variables).toEqual(["userName"]);
    });
  });

  describe("generate", () => {
    it("writes a file per prompt plus an index", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputDir();

      await generate({ rootDir, outputDir: out });

      const files = await readdir(out);
      expect(files).toContain("greet.ts");
      expect(files).toContain("index.ts");
    });

    it("each prompt file contains the function", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputDir();

      await generate({ rootDir, outputDir: out });

      const content = await readFile(join(out, "greet.ts"), "utf-8");
      expect(content).toContain("export function greet");
      expect(content).toContain("AUTO-GENERATED");
    });

    it("index.ts re-exports all prompts and defines prompts const", async () => {
      await writeTemplate("src/a.tpl.md", "A {{x}}");
      await writeTemplate("src/b.tpl.md", "B {{y}}");
      const out = outputDir();

      await generate({ rootDir, outputDir: out });

      const index = await readFile(join(out, "index.ts"), "utf-8");
      expect(index).toContain(`export * from "./a.js"`);
      expect(index).toContain(`export * from "./b.js"`);
      expect(index).toContain("export const prompts");
      expect(index).toContain("a,");
      expect(index).toContain("b,");
    });

    it("creates output directory if it does not exist", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      const out = join(rootDir, "deeply/nested/output/tpl");

      await generate({ rootDir, outputDir: out });

      const index = await readFile(join(out, "index.ts"), "utf-8");
      expect(index).toContain("AUTO-GENERATED");
    });

    it("returns correct count and outputDir", async () => {
      await writeTemplate("src/a.tpl.md", "A");
      await writeTemplate("src/b.tpl.md", "B");

      const result = await generate({ rootDir, outputDir: outputDir() });

      expect(result.count).toBe(2);
      expect(result.outputDir).toBe(outputDir());
      expect(result.templates).toHaveLength(2);
    });

    it("throws on name collision", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      await writeTemplate("other/greet.tpl.md", "Hi");

      await expect(
        generate({ rootDir, outputDir: outputDir() })
      ).rejects.toThrow(/greet/);
    });

    it("removes stale prompt files when a template is deleted", async () => {
      await writeTemplate("src/a.tpl.md", "A");
      await writeTemplate("src/b.tpl.md", "B");
      const out = outputDir();

      await generate({ rootDir, outputDir: out });
      let files = await readdir(out);
      expect(files).toContain("a.ts");
      expect(files).toContain("b.ts");

      // Remove b.tpl.md and regenerate
      await rm(join(rootDir, "src/b.tpl.md"));
      await generate({ rootDir, outputDir: out });

      files = await readdir(out);
      expect(files).toContain("a.ts");
      expect(files).not.toContain("b.ts");
    });

    it("generates valid TypeScript with correct exports", async () => {
      await writeTemplate(
        "src/welcome-email.tpl.md",
        "---\ndescription: Welcome email\n---\nHello {{userName}} from {{product}}!"
      );

      const out = outputDir();
      await generate({ rootDir, outputDir: out });

      const promptFile = await readFile(join(out, "welcomeEmail.ts"), "utf-8");
      expect(promptFile).toContain("export interface WelcomeEmailVariables");
      expect(promptFile).toContain("export function welcomeEmail");
      expect(promptFile).toContain("${vars.userName}");
      expect(promptFile).toContain("${vars.product}");

      const index = await readFile(join(out, "index.ts"), "utf-8");
      expect(index).toContain("export const prompts");
    });
  });
});
