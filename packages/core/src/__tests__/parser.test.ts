import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseTemplate, deriveFunctionName, SUPPORTED_EXTENSIONS } from "../parser.js";

describe("deriveFunctionName", () => {
  it("converts single-segment kebab-case to camelCase", () => {
    expect(deriveFunctionName("welcome-email.tpl.md")).toBe("welcomeEmail");
  });

  it("converts multi-segment kebab-case to camelCase", () => {
    expect(deriveFunctionName("search-query-builder.tpl.md")).toBe("searchQueryBuilder");
  });

  it("leaves single-word names unchanged", () => {
    expect(deriveFunctionName("base.tpl.md")).toBe("base");
  });

  it("works with full paths", () => {
    expect(deriveFunctionName("/project/src/features/auth/welcome-email.tpl.md")).toBe(
      "welcomeEmail"
    );
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
    expect(deriveFunctionName("order-confirmation.tpl.html")).toBe("orderConfirmation");
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
    await writeFile(path, content, "utf-8");
    return path;
  }

  it("extracts plain variables with string type", async () => {
    const path = await write(
      "greet.tpl.md",
      "Hello {{userName}}, welcome to {{productName}}!"
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables).toHaveLength(2);
    expect(result.variables[0]).toMatchObject({ name: "userName", type: "string", optional: false });
    expect(result.variables[1]).toMatchObject({ name: "productName", type: "string", optional: false });
  });

  it("parses typed variable {{name:number}}", async () => {
    const path = await write("count.tpl.md", "Count: {{limit:number}} items");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0]).toMatchObject({ name: "limit", type: "number", optional: false });
  });

  it("parses typed variable {{name:boolean}}", async () => {
    const path = await write("flag.tpl.md", "Enabled: {{active:boolean}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({ name: "active", type: "boolean", optional: false });
  });

  it("parses typed variable {{name:string[]}}", async () => {
    const path = await write("list.tpl.md", "Items: {{tags:string[]}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({ name: "tags", type: "string[]", optional: false });
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

  it("variables in {{#if}} blocks are marked optional", async () => {
    const path = await write(
      "note.tpl.md",
      "Hello!\n{{#if note}}\n**Note:** {{note}}\n{{/if}}"
    );
    const result = await parseTemplate(path, tmpDir);
    const noteVar = result.variables.find((v) => v.name === "note");
    expect(noteVar).toBeDefined();
    expect(noteVar?.optional).toBe(true);
  });

  it("condition-only variable is still included", async () => {
    const path = await write("beta.tpl.md", "{{#if betaUser}}\nBeta features enabled.\n{{/if}}");
    const result = await parseTemplate(path, tmpDir);
    const v = result.variables.find((v) => v.name === "betaUser");
    expect(v).toBeDefined();
    expect(v?.optional).toBe(true);
  });

  it("deduplicates variables preserving order", async () => {
    const path = await write(
      "greet.tpl.md",
      "{{name}} is {{name}} and {{other}} is {{name}}"
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
      "{{> shared/base}}\nHello {{userName}}"
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables.map((v) => v.name)).toEqual(["userName"]);
    expect(result.variables.map((v) => v.name)).not.toContain("> shared/base");
  });

  it("extracts includes correctly", async () => {
    const path = await write(
      "with-include.tpl.md",
      "{{> shared/base-persona}}\n{{> footer}}\nHello {{name}}"
    );
    const result = await parseTemplate(path, tmpDir);
    expect(result.includes).toEqual(["shared/base-persona", "footer"]);
  });

  it("returns empty includes when none present", async () => {
    const path = await write("simple.tpl.md", "Hello {{name}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.includes).toEqual([]);
  });

  it("parses frontmatter description", async () => {
    const path = await write(
      "with-fm.tpl.md",
      "---\ndescription: A test prompt\n---\nHello {{name}}"
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
      "---\ndescription: Test\n---\nActual content {{var}}"
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

  it("trims whitespace from variable names", async () => {
    const path = await write("trim.tpl.md", "Hello {{ name }} and {{ other }}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables.map((v) => v.name)).toEqual(["name", "other"]);
  });

  it("invalid type falls back to string", async () => {
    const path = await write("bad.tpl.md", "{{count:object}}");
    const result = await parseTemplate(path, tmpDir);
    expect(result.variables[0]).toMatchObject({ name: "count", type: "string" });
  });
});
