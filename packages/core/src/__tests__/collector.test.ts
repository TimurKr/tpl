import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  async function writeTemplate(
    relPath: string,
    content: string,
  ): Promise<void> {
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
      expect(names).toEqual(["a", "nestedB"]);
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
      expect(templates[0]?.functionName).toBe("real");
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
      expect(templates[0]?.functionName).toBe("real");
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

    it("uses the folder path for index templates while preserving the source stem", async () => {
      await writeTemplate("src/features/auth/index.tpl.md", "Auth {{name}}");

      const templates = await collect({ rootDir, outputFile: outputFile() });

      expect(templates).toHaveLength(1);
      expect(templates[0]?.sourceStem).toBe("index");
      expect(templates[0]?.functionName).toBe("featuresAuth");
      expect(templates[0]?.promptPath).toEqual(["features", "auth"]);
    });

    it("parses templates correctly with VariableDef", async () => {
      await writeTemplate(
        "src/welcome.tpl.md",
        "---\ndescription: Welcome message\n---\nHello {{userName}}!",
      );

      const templates = await collect({ rootDir, outputFile: outputFile() });
      expect(templates).toHaveLength(1);
      const t = templates[0]!;
      expect(t.functionName).toBe("welcome");
      expect(t.description).toBe("Welcome message");
      expect(t.variables).toHaveLength(1);
      expect(t.variables[0]).toMatchObject({
        name: "userName",
        type: "string",
        optional: false,
      });
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

    it("each prompt file reads the source .tpl.md and uses renderTemplate", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const content = await readFile(
        join(rootDir, "src/greet.tpl.gen.ts"),
        "utf-8",
      );
      expect(content).toContain("export function buildGreetPrompt");
      expect(content).toContain("AUTO-GENERATED");
      expect(content).toContain("renderTemplate");
      expect(content).toContain(`readFileSync`);
      expect(content).toContain(`fileURLToPath(import.meta.url)`);
      expect(content).toContain(`"./greet.tpl.md"`);
      expect(content).not.toContain(`import TEMPLATE from`);
    });

    it("generates tpl.d.ts with ambient module declaration", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const files = await readdir(join(rootDir, "lib"));
      expect(files).toContain("tpl.d.ts");

      const dts = await readFile(join(rootDir, "lib/tpl.d.ts"), "utf-8");
      expect(dts).toContain(`declare module "*.tpl.md"`);
    });

    it("removes the old tpl.gen.env.d.ts when generating tpl.d.ts", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      const out = outputFile();
      await mkdir(join(rootDir, "lib"), { recursive: true });
      await writeFile(
        join(rootDir, "lib/tpl.gen.env.d.ts"),
        "// AUTO-GENERATED by tpl — do not edit\n",
        "utf-8",
      );

      await generate({ rootDir, outputFile: out });

      const files = await readdir(join(rootDir, "lib"));
      expect(files).toContain("tpl.d.ts");
      expect(files).not.toContain("tpl.gen.env.d.ts");
    });

    it("manifest re-exports all prompts and defines nested prompts const", async () => {
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
      expect(index).toContain("export const promptMap");
    });

    it("generates index templates with folder-derived builder and prompt names", async () => {
      await writeTemplate("src/features/auth/index.tpl.md", "Auth {{name}}");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const promptFile = await readFile(
        join(rootDir, "src/features/auth/index.tpl.gen.ts"),
        "utf-8",
      );
      expect(promptFile).toContain("export interface FeaturesAuthVariables");
      expect(promptFile).toContain("export function buildFeaturesAuthPrompt");

      const index = await readFile(out, "utf-8");
      expect(index).toContain(
        `export * from "../src/features/auth/index.tpl.gen.js"`,
      );
      expect(index).toContain("features: {");
      expect(index).toContain("auth: buildFeaturesAuthPrompt,");
      expect(index).toContain(`"features.auth": buildFeaturesAuthPrompt`);
      expect(index).not.toContain("index: buildFeaturesAuthPrompt");
    });

    it("applies namespace aliases before generating index template names", async () => {
      await writeTemplate(
        "app/(marketing)/signup/_prompts/index.tpl.md",
        "Signup {{name}}",
      );
      const out = outputFile();

      const result = await generate({
        rootDir,
        outputFile: out,
        namespaceAliases: {
          app: "",
          "(marketing)": "marketing",
          _prompts: "",
        },
      });

      expect(result.issues).toEqual([]);
      const index = await readFile(out, "utf-8");
      expect(index).toContain("marketing: {");
      expect(index).toContain("signup: buildMarketingSignupPrompt,");
      expect(index).toContain(`"marketing.signup": buildMarketingSignupPrompt`);
      expect(index).not.toContain("prompts: {");
      expect(index).not.toContain("index: buildMarketingSignupPrompt");
    });

    it("manifest exports renderPrompt", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      const out = outputFile();

      await generate({ rootDir, outputFile: out });

      const index = await readFile(out, "utf-8");
      expect(index).toContain(
        "export function renderPrompt<Name extends PromptName>(",
      );
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
      expect(result.issues).toEqual([]);
    });

    it("reports generation issues after writing diagnostic files", async () => {
      await writeTemplate("src/greet.tpl.md", "A");
      await writeTemplate("other/greet.tpl.md", "B");
      const out = outputFile();

      const result = await generate({
        rootDir,
        outputFile: out,
        namespaceAliases: { other: "" },
      });

      expect(result.issues).toContainEqual({
        kind: "name-collision",
        filePath: join(rootDir, "src/greet.tpl.gen.ts"),
      });
      const generated = await readFile(
        join(rootDir, "src/greet.tpl.gen.ts"),
        "utf-8",
      );
      expect(generated).toContain("NAME COLLISION");
    });

    it("reports include errors after writing diagnostic files", async () => {
      await writeTemplate("src/broken.tpl.md", "{{> ./missing}}");
      const out = outputFile();

      const result = await generate({ rootDir, outputFile: out });

      expect(result.issues).toContainEqual({
        kind: "include-error",
        filePath: join(rootDir, "src/broken.tpl.gen.ts"),
      });
      const generated = await readFile(
        join(rootDir, "src/broken.tpl.gen.ts"),
        "utf-8",
      );
      expect(generated).toContain("TEMPLATE INCLUDE ERROR");
    });

    it("same file stems in different folders produce distinct prompt names", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello");
      await writeTemplate("other/greet.tpl.md", "Hi");
      const out = outputFile();

      const result = await generate({ rootDir, outputFile: out });

      const files = await readdir(join(rootDir, "src"));
      expect(files).toContain("greet.tpl.gen.ts");

      const index = await readFile(out, "utf-8");
      expect(index).toContain("greet: buildGreetPrompt,");
      expect(index).toContain("other: {");
      expect(index).toContain("greet: buildOtherGreetPrompt,");

      expect(result.count).toBe(2); // 2 templates parsed
    });

    it("reports a collision when folder.tpl and folder/index.tpl share the same prompt name", async () => {
      await writeTemplate("src/auth.tpl.md", "Auth root");
      await writeTemplate("src/auth/index.tpl.md", "Auth index");
      const out = outputFile();

      const result = await generate({ rootDir, outputFile: out });

      expect(result.issues).toContainEqual({
        kind: "name-collision",
        filePath: join(rootDir, "src/auth.tpl.gen.ts"),
      });
      expect(result.issues).toContainEqual({
        kind: "name-collision",
        filePath: join(rootDir, "src/auth/index.tpl.gen.ts"),
      });

      const generated = await readFile(
        join(rootDir, "src/auth/index.tpl.gen.ts"),
        "utf-8",
      );
      expect(generated).toContain("NAME COLLISION");
      expect(generated).toContain("src/auth.tpl.md");
      expect(generated).toContain("src/auth/index.tpl.md");
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
        "---\ndescription: Welcome email\n---\nHello {{userName}} from {{product}}!",
      );

      const out = outputFile();
      await generate({ rootDir, outputFile: out });

      const promptFile = await readFile(
        join(rootDir, "src/welcome-email.tpl.gen.ts"),
        "utf-8",
      );
      expect(promptFile).toContain("export interface WelcomeEmailVariables");
      expect(promptFile).toContain("export function buildWelcomeEmailPrompt");
      expect(promptFile).toContain("renderTemplate(TEMPLATE, vars)");
      expect(promptFile).toContain(`readFileSync`);
      expect(promptFile).not.toContain(`import TEMPLATE from`);

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
      expect(result.issues.map((issue) => issue.filePath)).toContain(
        join(rootDir, "src/greet.tpl.gen.ts"),
      );
      expect(result.issues.map((issue) => issue.filePath)).toContain(out);
    });

    it("reports changed generated files", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();
      await generate({ rootDir, outputFile: out });
      await writeFile(
        join(rootDir, "src/greet.tpl.gen.ts"),
        "// edited\n",
        "utf-8",
      );

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

    it("passes check when postprocess matches generate", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();
      const pp = join(rootDir, "tpl.postprocess.mjs");
      await writeFile(
        pp,
        `export default function (filePath, content) {
  void filePath;
  return "// post\\n" + content;
}
`,
        "utf-8",
      );

      await generate({
        rootDir,
        outputFile: out,
        postprocess: "./tpl.postprocess.mjs",
      });

      const gen = await readFile(
        join(rootDir, "src/greet.tpl.gen.ts"),
        "utf-8",
      );
      expect(gen.startsWith("// post\n")).toBe(true);

      const result = await check({
        rootDir,
        outputFile: out,
        postprocess: "./tpl.postprocess.mjs",
      });
      expect(result.ok).toBe(true);
    });

    it("fails check without postprocess after generate with postprocess", async () => {
      await writeTemplate("src/greet.tpl.md", "Hello {{name}}");
      const out = outputFile();
      const pp = join(rootDir, "tpl.postprocess.mjs");
      await writeFile(
        pp,
        `export default function (filePath, content) {
  void filePath;
  return "// post\\n" + content;
}
`,
        "utf-8",
      );

      await generate({
        rootDir,
        outputFile: out,
        postprocess: "./tpl.postprocess.mjs",
      });

      const result = await check({ rootDir, outputFile: out });
      expect(result.ok).toBe(false);
      expect(result.issues.map((i) => i.kind)).toContain("changed");
    });
  });
});
