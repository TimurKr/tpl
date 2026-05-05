import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  deriveFunctionName,
  derivePromptPath,
  parseTemplate,
  SUPPORTED_EXTENSIONS,
} from "../parser.js";

describe("deriveFunctionName", () => {
  it("converts single-segment kebab-case to camelCase", () => {
    expect(deriveFunctionName("welcome-email.tpl.md")).toBe("welcomeEmail");
  });

  it("converts multi-segment kebab-case to camelCase", () => {
    expect(deriveFunctionName("search-query-builder.tpl.md")).toBe(
      "searchQueryBuilder",
    );
  });

  it("leaves single-word names unchanged", () => {
    expect(deriveFunctionName("base.tpl.md")).toBe("base");
  });

  it("works with full paths", () => {
    expect(
      deriveFunctionName(
        "/project/src/features/auth/welcome-email.tpl.md",
        "/project",
      ),
    ).toBe("featuresAuthWelcomeEmail");
  });

  it("keeps basename behavior when rootDir is omitted", () => {
    expect(
      deriveFunctionName("/project/src/features/auth/welcome-email.tpl.md"),
    ).toBe("welcomeEmail");
  });

  it("uses the parent folder name for index templates in path-derived names", () => {
    expect(
      derivePromptPath("/project/src/features/auth/index.tpl.md", "/project"),
    ).toEqual(["features", "auth"]);
    expect(
      deriveFunctionName("/project/src/features/auth/index.tpl.md", "/project"),
    ).toBe("featuresAuth");
  });

  it("keeps index as the name when no parent folder participates in naming", () => {
    expect(derivePromptPath("/project/index.tpl.md", "/project")).toEqual([
      "index",
    ]);
    expect(deriveFunctionName("/project/index.tpl.md", "/project")).toBe(
      "index",
    );
  });

  it("applies namespace aliases before defaulting index templates to their folder", () => {
    const aliases = {
      app: "",
      "(marketing)": "marketing",
      _prompts: "",
    };

    expect(
      derivePromptPath(
        "/project/app/(marketing)/signup/_prompts/index.tpl.md",
        "/project",
        aliases,
      ),
    ).toEqual(["marketing", "signup"]);
    expect(
      deriveFunctionName(
        "/project/app/(marketing)/signup/_prompts/index.tpl.md",
        "/project",
        aliases,
      ),
    ).toBe("marketingSignup");
  });

  it("uses renamed namespace segments for index template folder defaults", () => {
    expect(
      derivePromptPath("/project/src/features/auth/index.tpl.md", "/project", {
        features: "",
        auth: "account",
      }),
    ).toEqual(["account"]);
    expect(
      deriveFunctionName(
        "/project/src/features/auth/index.tpl.md",
        "/project",
        {
          features: "",
          auth: "account",
        },
      ),
    ).toBe("account");
  });

  it("converts two-word kebab", () => {
    expect(deriveFunctionName("search-query.tpl.md")).toBe("searchQuery");
  });

  it("strips .tpl.mdx extension", () => {
    expect(deriveFunctionName("welcome-email.tpl.mdx")).toBe("welcomeEmail");
  });

  it("strips .tpl.txt extension", () => {
    expect(deriveFunctionName("classify.tpl.txt")).toBe("classify");
  });

  it("strips .tpl.html extension", () => {
    expect(deriveFunctionName("order-confirmation.tpl.html")).toBe(
      "orderConfirmation",
    );
  });

  it("exports the supported extensions list", () => {
    expect(SUPPORTED_EXTENSIONS).toContain("md");
    expect(SUPPORTED_EXTENSIONS).toContain("mdx");
    expect(SUPPORTED_EXTENSIONS).toContain("txt");
    expect(SUPPORTED_EXTENSIONS).toContain("html");
  });
});

describe("parseTemplate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `tpl-parser-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function write(name: string, content: string): Promise<string> {
    const path = join(tmpDir, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
    return path;
  }

  it("extracts plain variables with string type", async () => {
    const path = await write(
      "greet.tpl.md",
      "Hello {{userName}}, welcome to {{productName}}!",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables).toHaveLength(2);
    expect(result.variables[0]).toMatchObject({
      name: "userName",
      type: "string",
      optional: false,
    });
    expect(result.variables[1]).toMatchObject({
      name: "productName",
      type: "string",
      optional: false,
    });
  });

  it("parses typed variable {{name:number}}", async () => {
    const path = await write("count.tpl.md", "Count: {{limit:number}} items");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0]).toMatchObject({
      name: "limit",
      type: "number",
      optional: false,
    });
  });

  it("parses typed variable {{name:boolean}}", async () => {
    const path = await write("flag.tpl.md", "Enabled: {{active:boolean}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({
      name: "active",
      type: "boolean",
      optional: false,
    });
  });

  it("parses typed variable {{name:string[]}}", async () => {
    const path = await write("list.tpl.md", "Items: {{tags:string[]}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({
      name: "tags",
      type: "string[]",
      optional: false,
    });
  });

  it("parses optional variable with default {{name|default}}", async () => {
    const path = await write("greet.tpl.md", "Hello {{name|World}}!");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({
      name: "name",
      type: "string",
      optional: true,
      defaultValue: "World",
    });
  });

  it("parses typed optional with default {{name:number|0}}", async () => {
    const path = await write("count.tpl.md", "Count: {{limit:number|10}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({
      name: "limit",
      type: "number",
      optional: true,
      defaultValue: "10",
    });
  });

  it("variables in {{#if}} blocks are marked optional while preserving usage type", async () => {
    const path = await write(
      "note.tpl.md",
      "Hello!\n{{#if note}}\n**Note:** {{note}}\n{{/if}}",
    );
    const result = await parseTemplate(path, tmpDir);
    const noteVar = result.variables.find((v) => v.name === "note");
    expect(noteVar).toBeDefined();
    expect(noteVar?.optional).toBe(true);
    expect(noteVar?.type).toBe("string");
  });

  it("condition-only variable is inferred as optional boolean", async () => {
    const path = await write(
      "beta.tpl.md",
      "{{#if betaUser}}\nBeta features enabled.\n{{/if}}",
    );
    const result = await parseTemplate(path, tmpDir);
    const v = result.variables.find((v) => v.name === "betaUser");
    expect(v).toBeDefined();
    expect(v?.optional).toBe(true);
    expect(v?.type).toBe("boolean");
  });

  it("infers switch-only discriminant as required case literal union", async () => {
    const path = await write(
      "mode.tpl.md",
      "{{#switch mode}}{{#case \"x\"}}X{{/case}}{{#case 'y'}}Y{{/case}}{{#case z}}Z{{/case}}{{/switch}}",
    );
    const result = await parseTemplate(path, tmpDir);
    const v = result.variables.find((x) => x.name === "mode");
    expect(v).toMatchObject({
      name: "mode",
      type: '"x" | "y" | "z"',
      optional: false,
    });
  });

  it("makes switch-only discriminant optional when every switch has a default", async () => {
    const path = await write(
      "mode-default.tpl.md",
      '{{#switch mode}}{{#case "x"}}X{{/case}}{{#default}}Fallback{{/default}}{{/switch}}',
    );
    const result = await parseTemplate(path, tmpDir);
    const v = result.variables.find((x) => x.name === "mode");
    expect(v).toMatchObject({
      name: "mode",
      type: '"x"',
      optional: true,
    });
  });

  it("keeps switch-only discriminant required when any matching switch has no default", async () => {
    const path = await write(
      "mode-mixed-default.tpl.md",
      '{{#switch mode}}{{#case "x"}}X{{/case}}{{#default}}Fallback{{/default}}{{/switch}}\n{{#switch mode}}{{#case "y"}}Y{{/case}}{{/switch}}',
    );
    const result = await parseTemplate(path, tmpDir);
    const v = result.variables.find((x) => x.name === "mode");
    expect(v).toMatchObject({
      name: "mode",
      type: '"x" | "y"',
      optional: false,
    });
  });

  it("keeps existing variable declaration when discriminant also appears as {{var}}", async () => {
    const path = await write(
      "mode2.tpl.md",
      'Mode: {{mode}}\n{{#switch mode}}{{#case "a"}}A{{/case}}{{/switch}}',
    );
    const result = await parseTemplate(path, tmpDir);
    const v = result.variables.find((x) => x.name === "mode");
    expect(v).toMatchObject({ name: "mode", type: "string", optional: false });
  });

  it("does not override condition-only #if typing when same name is switch discriminant", async () => {
    const path = await write(
      "amb.tpl.md",
      '{{#if mode}}{{#switch mode}}{{#case "a"}}A{{/case}}{{/switch}}{{/if}}',
    );
    const result = await parseTemplate(path, tmpDir);
    const v = result.variables.find((x) => x.name === "mode");
    expect(v).toMatchObject({ name: "mode", type: "boolean", optional: true });
  });

  it("deduplicates variables preserving order", async () => {
    const path = await write(
      "greet.tpl.md",
      "{{name}} is {{name}} and {{other}} is {{name}}",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables.map((v) => v.name)).toEqual(["name", "other"]);
  });

  it("returns empty variables when none present", async () => {
    const path = await write("simple.tpl.md", "No variables here.");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables).toEqual([]);
  });

  it("does not treat includes as variables", async () => {
    const path = await write(
      "with-include.tpl.md",
      "{{> ./shared/base}}\nHello {{userName}}",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables.map((v) => v.name)).toEqual(["userName"]);
    expect(result.variables.map((v) => v.name)).not.toContain("> shared/base");
  });

  it("extracts includes correctly", async () => {
    const path = await write(
      "with-include.tpl.md",
      "{{> ./shared/base-persona}}\n{{> ./footer}}\nHello {{name}}",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.includes).toEqual([
      { path: "./shared/base-persona" },
      { path: "./footer" },
    ]);
  });

  it("extracts include aliases", async () => {
    const path = await write(
      "with-include-alias.tpl.md",
      "{{> ./shared/base-persona as persona}}\nHello {{name}}",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.includes).toEqual([
      { path: "./shared/base-persona", alias: "persona" },
    ]);
  });

  it("returns empty includes when none present", async () => {
    const path = await write("simple.tpl.md", "Hello {{name}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.includes).toEqual([]);
  });

  it("parses frontmatter description", async () => {
    const path = await write(
      "with-fm.tpl.md",
      "---\ndescription: A test prompt\n---\nHello {{name}}",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.description).toBe("A test prompt");
  });

  it("sets description to undefined when not in frontmatter", async () => {
    const path = await write("no-fm.tpl.md", "Hello {{name}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.description).toBeUndefined();
  });

  it("rawContent does not include frontmatter", async () => {
    const path = await write(
      "with-fm.tpl.md",
      "---\ndescription: Test\n---\nActual content {{var}}",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.rawContent).not.toContain("description:");
    expect(result.rawContent).toContain("Actual content {{var}}");
  });

  it("derives correct function name from file path", async () => {
    const path = await write("welcome-email.tpl.md", "Hello {{name}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.functionName).toBe("welcomeEmail");
  });

  it("derives function name from path relative to root", async () => {
    const path = await write(
      "features/auth/welcome-email.tpl.md",
      "Hello {{name}}",
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.functionName).toBe("featuresAuthWelcomeEmail");
    expect(result.promptPath).toEqual(["features", "auth", "welcomeEmail"]);
  });

  it("parses index templates as the containing folder prompt", async () => {
    const path = await write("features/auth/index.tpl.md", "Hello {{name}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.sourceStem).toBe("index");
    expect(result.functionName).toBe("featuresAuth");
    expect(result.promptPath).toEqual(["features", "auth"]);
  });

  it("applies namespace aliases before deriving names", async () => {
    const path = await write(
      "app/(marketing)/signup/_prompts/welcome-email.tpl.md",
      "Hello {{name}}",
    );
    const result = await parseTemplate(path, tmpDir, {
      app: "",
      "(marketing)": "marketing",
      _prompts: "",
    });
    expect(result.promptPath).toEqual(["marketing", "signup", "welcomeEmail"]);
    expect(result.functionName).toBe("marketingSignupWelcomeEmail");
  });

  it("trims whitespace from variable names", async () => {
    const path = await write("trim.tpl.md", "Hello {{ name }} and {{ other }}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables.map((v) => v.name)).toEqual(["name", "other"]);
  });

  it("invalid type falls back to string", async () => {
    const path = await write("bad.tpl.md", "{{count:object}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({
      name: "count",
      type: "string",
    });
  });
});
