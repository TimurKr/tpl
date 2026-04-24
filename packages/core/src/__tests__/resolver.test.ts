import { describe, it, expect } from "bun:test";
import { resolveIncludes } from "../resolver.js";
import type { ParsedTemplate } from "../types.js";

function makeTemplate(
  overrides: Partial<ParsedTemplate> & { functionName: string; rawContent: string }
): ParsedTemplate {
  return {
    filePath: `/project/${overrides.functionName}.tpl.md`,
    variables: [],
    includes: [],
    ...overrides,
  };
}

describe("resolveIncludes", () => {
  it("returns content unchanged when there are no includes", () => {
    const template = makeTemplate({
      functionName: "greeting",
      rawContent: "Hello {{name}}",
    });
    const map = new Map([["greeting", template]]);
    expect(resolveIncludes(template, map)).toBe("Hello {{name}}");
  });

  it("replaces a simple include with its content", () => {
    const base = makeTemplate({
      functionName: "base",
      filePath: "/project/shared/base.tpl.md",
      rawContent: "You are a helpful assistant.",
    });
    const main = makeTemplate({
      functionName: "main",
      rawContent: "{{> shared/base}}\nPlease help {{userName}}.",
      includes: ["shared/base"],
    });
    const map = new Map([
      ["base", base],
      ["main", main],
    ]);
    const result = resolveIncludes(main, map);
    expect(result).toBe("You are a helpful assistant.\nPlease help {{userName}}.");
  });

  it("resolves nested includes", () => {
    const persona = makeTemplate({
      functionName: "persona",
      filePath: "/project/shared/persona.tpl.md",
      rawContent: "You are an expert.",
    });
    const base = makeTemplate({
      functionName: "base",
      filePath: "/project/shared/base.tpl.md",
      rawContent: "{{> shared/persona}} Be concise.",
      includes: ["shared/persona"],
    });
    const main = makeTemplate({
      functionName: "main",
      rawContent: "{{> shared/base}}\nAnswer: {{answer}}",
      includes: ["shared/base"],
    });
    const map = new Map([
      ["persona", persona],
      ["base", base],
      ["main", main],
    ]);
    const result = resolveIncludes(main, map);
    expect(result).toBe("You are an expert. Be concise.\nAnswer: {{answer}}");
  });

  it("throws on missing include", () => {
    const main = makeTemplate({
      functionName: "main",
      rawContent: "{{> nonexistent/thing}}",
      includes: ["nonexistent/thing"],
    });
    const map = new Map([["main", main]]);
    expect(() => resolveIncludes(main, map)).toThrow(/nonexistent\/thing/);
  });

  it("throws on circular includes", () => {
    const a = makeTemplate({
      functionName: "a",
      filePath: "/project/a.tpl.md",
      rawContent: "{{> b}}",
      includes: ["b"],
    });
    const b = makeTemplate({
      functionName: "b",
      filePath: "/project/b.tpl.md",
      rawContent: "{{> a}}",
      includes: ["a"],
    });
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);
    expect(() => resolveIncludes(a, map)).toThrow(/[Cc]ircular/);
  });

  it("throws with helpful message on circular includes", () => {
    const a = makeTemplate({
      functionName: "selfRef",
      filePath: "/project/selfRef.tpl.md",
      rawContent: "{{> selfRef}}",
      includes: ["selfRef"],
    });
    const map = new Map([["selfRef", a]]);
    expect(() => resolveIncludes(a, map)).toThrow(/selfRef/);
  });

  it("resolves include by bare camelCase name (name-only reference)", () => {
    const base = makeTemplate({
      functionName: "base",
      filePath: "/project/shared/base.tpl.md",
      rawContent: "You are helpful.",
    });
    const main = makeTemplate({
      functionName: "main",
      // Note: using bare name "base" instead of "shared/base"
      rawContent: "{{> base}}\nAnswer: {{answer}}",
      includes: ["base"],
    });
    const map = new Map([
      ["base", base],
      ["main", main],
    ]);
    const result = resolveIncludes(main, map);
    expect(result).toBe("You are helpful.\nAnswer: {{answer}}");
  });

  it("resolves include by bare kebab-case name (name-only reference)", () => {
    const base = makeTemplate({
      functionName: "basePersona",
      filePath: "/project/shared/base-persona.tpl.md",
      rawContent: "You are an expert.",
    });
    const main = makeTemplate({
      functionName: "main",
      // Using kebab-case bare name
      rawContent: "{{> base-persona}}\nHelp with {{topic}}.",
      includes: ["base-persona"],
    });
    const map = new Map([
      ["basePersona", base],
      ["main", main],
    ]);
    const result = resolveIncludes(main, map);
    expect(result).toBe("You are an expert.\nHelp with {{topic}}.");
  });

  it("self-reference is still caught with name-only refs", () => {
    const selfRef = makeTemplate({
      functionName: "selfRef",
      filePath: "/project/selfRef.tpl.md",
      rawContent: "{{> selfRef}}",
      includes: ["selfRef"],
    });
    const map = new Map([["selfRef", selfRef]]);
    expect(() => resolveIncludes(selfRef, map)).toThrow(/[Cc]ircular/);
  });

  it("handles multiple includes in one template", () => {
    const header = makeTemplate({
      functionName: "header",
      filePath: "/project/shared/header.tpl.md",
      rawContent: "HEADER",
    });
    const footer = makeTemplate({
      functionName: "footer",
      filePath: "/project/shared/footer.tpl.md",
      rawContent: "FOOTER",
    });
    const main = makeTemplate({
      functionName: "main",
      rawContent: "{{> shared/header}}\nBody\n{{> shared/footer}}",
      includes: ["shared/header", "shared/footer"],
    });
    const map = new Map([
      ["header", header],
      ["footer", footer],
      ["main", main],
    ]);
    expect(resolveIncludes(main, map)).toBe("HEADER\nBody\nFOOTER");
  });
});
