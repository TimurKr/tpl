import { describe, expect, it } from "bun:test";
import { flattenVars, renderTemplate } from "../runtime.js";

describe("flattenVars", () => {
  it("returns flat vars unchanged", () => {
    expect(flattenVars({ a: "1", b: "2" })).toEqual({ a: "1", b: "2" });
  });

  it("flattens one level of nested object (partial vars)", () => {
    expect(
      flattenVars({
        userName: "Alice",
        footer: { email: "hi@example.com", phone: "123" },
      }),
    ).toEqual({ userName: "Alice", email: "hi@example.com", phone: "123" });
  });

  it("recursively flattens nested partials", () => {
    expect(flattenVars({ a: "1", b: { c: "2", d: { e: "3" } } })).toEqual({
      a: "1",
      c: "2",
      e: "3",
    });
  });

  it("keeps arrays as-is", () => {
    const result = flattenVars({ tags: ["a", "b"] });
    expect(result.tags).toEqual(["a", "b"]);
  });

  it("ignores null values", () => {
    const result = flattenVars({ a: null as unknown as string, b: "ok" });
    expect(result.b).toBe("ok");
  });
});

describe("renderTemplate", () => {
  it("throws a clear error when template source is not a string", () => {
    expect(() => renderTemplate(undefined as unknown as string, {})).toThrow(
      "TPL template source must be a string",
    );
  });

  it("substitutes a plain variable", () => {
    expect(renderTemplate("Hello {{name}}!", { name: "Alice" })).toBe(
      "Hello Alice!",
    );
  });

  it("substitutes multiple variables", () => {
    expect(renderTemplate("{{a}} and {{b}}", { a: "foo", b: "bar" })).toBe(
      "foo and bar",
    );
  });

  it("uses default value when variable is missing", () => {
    expect(renderTemplate("Hello {{name|World}}!", {})).toBe("Hello World!");
  });

  it("uses actual value when variable is present (ignores default)", () => {
    expect(renderTemplate("Hello {{name|World}}!", { name: "Alice" })).toBe(
      "Hello Alice!",
    );
  });

  it("renders typed variable {{name:number}} by ignoring the type annotation", () => {
    expect(renderTemplate("Count: {{limit:number}}", { limit: 42 })).toBe(
      "Count: 42",
    );
  });

  it("renders typed optional {{name:number|0}} with default", () => {
    expect(renderTemplate("Count: {{limit:number|0}}", {})).toBe("Count: 0");
  });

  it("renders conditional block when variable is truthy", () => {
    expect(
      renderTemplate("A{{#if note}}\nNote: {{note}}{{/if}}\nB", { note: "hi" }),
    ).toBe("A\nNote: hi\nB");
  });

  it("omits conditional block when variable is falsy", () => {
    expect(
      renderTemplate("A\n{{#if note}}\nNote: {{note}}\n{{/if}}\nB", {}),
    ).toBe("A\n\nB");
  });

  it("omits conditional block when variable is false", () => {
    expect(
      renderTemplate("{{#if active}}enabled{{/if}}", { active: false }),
    ).toBe("");
  });

  it("omits conditional block when variable is empty string", () => {
    expect(renderTemplate("{{#if active}}enabled{{/if}}", { active: "" })).toBe(
      "",
    );
  });

  it("omits both blocks when outer and inner conditionals are falsy", () => {
    expect(
      renderTemplate("{{#if a}}A{{#if b}}B{{/if}}{{/if}}", {
        a: false,
        b: false,
      }),
    ).toBe("");
  });

  it("renders only outer content when outer is truthy and inner is falsy", () => {
    expect(
      renderTemplate("{{#if a}}A{{#if b}}B{{/if}}C{{/if}}", {
        a: true,
        b: false,
      }),
    ).toBe("AC");
  });

  it("renders nested content when both conditionals are truthy", () => {
    expect(
      renderTemplate("{{#if a}}A{{#if b}}B{{/if}}C{{/if}}", {
        a: true,
        b: true,
      }),
    ).toBe("ABC");
  });

  it("omits inner block while outer is truthy when only inner is falsy", () => {
    expect(
      renderTemplate(
        "{{#if outer}}before {{#if inner}}MID{{/if}} after{{/if}}",
        { outer: true, inner: false },
      ),
    ).toBe("before  after");
  });

  it("handles deeply nested conditionals", () => {
    expect(
      renderTemplate("{{#if a}}1{{#if b}}2{{#if c}}3{{/if}}4{{/if}}5{{/if}}", {
        a: true,
        b: true,
        c: true,
      }),
    ).toBe("12345");
    expect(
      renderTemplate("{{#if a}}1{{#if b}}2{{#if c}}3{{/if}}4{{/if}}5{{/if}}", {
        a: true,
        b: false,
        c: true,
      }),
    ).toBe("15");
  });

  it("handles two sibling conditional blocks", () => {
    expect(
      renderTemplate("{{#if a}}A{{/if}}-{{#if b}}B{{/if}}", {
        a: true,
        b: false,
      }),
    ).toBe("A-");
  });

  it("renders nested partials by flattening vars", () => {
    const result = renderTemplate("Hi {{userName}}, email: {{email}}", {
      userName: "Alice",
      footer: { email: "alice@example.com" },
    });
    expect(result).toBe("Hi Alice, email: alice@example.com");
  });

  it("resolves partial aliases", () => {
    const result = renderTemplate(
      "Hello\n{{> ./shared/footer as footer}}",
      {},
      { footer: "Footer text" },
    );
    expect(result).toBe("Hello\nFooter text");
  });

  it("renders string[] by joining with comma", () => {
    expect(
      renderTemplate("Tags: {{tags:string[]}}", { tags: ["a", "b", "c"] }),
    ).toBe("Tags: a, b, c");
  });

  it("leaves unreplaced {{var}} when no value and no default", () => {
    expect(renderTemplate("Hello {{unknown}}", {})).toBe("Hello {{unknown}}");
  });

  it("collapses triple newlines to double newlines", () => {
    const result = renderTemplate("A\n\n\nB", {});
    expect(result).toBe("A\n\nB");
  });

  it("trims leading and trailing whitespace", () => {
    expect(renderTemplate("  Hello  ", {})).toBe("Hello");
  });

  it("handles number variable (converts to string)", () => {
    expect(renderTemplate("{{count}}", { count: 42 })).toBe("42");
  });

  it("handles boolean variable (converts to string)", () => {
    expect(renderTemplate("{{flag}}", { flag: true })).toBe("true");
  });

  it("renders first matching switch case (double-quoted literal)", () => {
    const tpl = `{{#switch role}}{{#case "admin"}}A{{/case}}{{#case "user"}}U{{/case}}{{/switch}}`;
    expect(renderTemplate(tpl, { role: "user" })).toBe("U");
    expect(renderTemplate(tpl, { role: "admin" })).toBe("A");
  });

  it("renders switch case with single-quoted or bare word literal", () => {
    expect(
      renderTemplate(
        `{{#switch x}}{{#case 'b'}}B{{/case}}{{#case c}}C{{/case}}{{/switch}}`,
        { x: "c" },
      ),
    ).toBe("C");
    expect(
      renderTemplate(
        `{{#switch x}}{{#case 'b'}}B{{/case}}{{#case c}}C{{/case}}{{/switch}}`,
        { x: "b" },
      ),
    ).toBe("B");
  });

  it("uses default when no case matches", () => {
    const tpl = `{{#switch m}}{{#case "a"}}A{{/case}}{{#default}}Z{{/default}}{{/switch}}`;
    expect(renderTemplate(tpl, { m: "x" })).toBe("Z");
  });

  it("omits switch output when no case matches and no default", () => {
    const tpl = `{{#switch m}}{{#case "a"}}A{{/case}}{{/switch}}`;
    expect(renderTemplate(tpl, { m: "other" })).toBe("");
  });

  it("does not expand switch inside a falsy if branch", () => {
    const tpl = `{{#if show}}{{#switch k}}{{#case "1"}}one{{/case}}{{/switch}}{{/if}}`;
    expect(renderTemplate(tpl, { show: false, k: "1" })).toBe("");
  });

  it("runs if inside a chosen case after switch resolves", () => {
    const tpl = `{{#switch k}}{{#case "a"}}{{#if extra}}X{{/if}}Y{{/case}}{{/switch}}`;
    expect(renderTemplate(tpl, { k: "a", extra: true })).toBe("XY");
    expect(renderTemplate(tpl, { k: "a", extra: false })).toBe("Y");
  });

  it('matches {{#case ""}} when discriminant is missing or null', () => {
    const tpl = `{{#switch k}}{{#case ""}}empty{{/case}}{{#default}}d{{/default}}{{/switch}}`;
    expect(renderTemplate(tpl, {} as object)).toBe("empty");
    expect(renderTemplate(tpl, { k: null as unknown as string })).toBe("empty");
    expect(renderTemplate(tpl, { k: "x" })).toBe("d");
  });

  it("resolves nested switch in a case body", () => {
    const tpl = `{{#switch o}}{{#case "out"}}{{#switch i}}{{#case "in"}}ok{{/case}}{{/switch}}{{/case}}{{/switch}}`;
    expect(renderTemplate(tpl, { o: "out", i: "in" })).toBe("ok");
  });
});
