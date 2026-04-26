/**
 * TPL runtime — used by generated prompt files at runtime.
 *
 * Supports:
 *   {{var}}              — required variable substitution
 *   {{var:type}}         — typed variable (type ignored at runtime, used for codegen)
 *   {{var|default}}      — optional with default value
 *   {{var:type|default}} — typed optional with default
 *   {{#if var}}...{{/if}} — conditional block (renders when var is truthy)
 *   {{> ./partial}}      — resolved at runtime using the partials map
 *   {{> ./partial as x}} — resolved using alias key "x"
 */

import { INCLUDE_RE, parseIncludeExpression } from "./patterns.js";

/**
 * Strip YAML frontmatter from a raw .tpl.md file string.
 * A no-op if the content does not start with a `---` fence.
 */
function stripFrontmatter(content: string): string {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return trimmed;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return trimmed;
  return trimmed.slice(end + 4).trimStart();
}

/**
 * Recursively resolve {{> ./path}} include directives using the provided partials map.
 * Circular references are silently dropped (they are caught at codegen time and
 * produce TypeScript errors in the generated file).
 */
function resolvePartials(
  content: string,
  partials: Record<string, string>,
  visited: Set<string>,
): string {
  INCLUDE_RE.lastIndex = 0;
  return content.replace(INCLUDE_RE, (match, rawName: string) => {
    const include = parseIncludeExpression(rawName);
    const partialKey = include.alias ?? include.path;
    const partialRaw = partials[partialKey];
    if (!partialRaw) return match; // leave unreplaced if not in partials map
    if (visited.has(partialKey)) return ""; // circular — skip
    const nextVisited = new Set([...visited, partialKey]);
    const stripped = stripFrontmatter(partialRaw);
    return resolvePartials(stripped, partials, nextVisited).trim();
  });
}

/**
 * Recursively flatten a nested vars object into a flat key-value map.
 * Nested objects (partial variable groups) are spread into the top level.
 * Arrays and primitives are kept as-is.
 */
export function flattenVars(vars: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(vars)) {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(result, flattenVars(val));
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Render a template string against a vars object.
 *
 * `content` is the raw source of a `.tpl.md` file — frontmatter is stripped
 * automatically, so you can pass the result of `import raw from "*.tpl.md"` directly.
 *
 * `partials` is an optional map of `{ includePathOrAlias: rawFileContent }` used to
 * resolve `{{> ./path}}` includes at runtime. Pass the raw source strings of the
 * included partial files (frontmatter still present — it will be stripped).
 *
 * Vars from nested partial objects are automatically flattened before substitution.
 */
export function renderTemplate<T extends object>(
  content: string,
  vars: T,
  partials?: Record<string, string>,
): string {
  const flat = flattenVars(vars);

  // Strip frontmatter from the raw file content
  let result = stripFrontmatter(content);

  // Resolve partial includes if a partials map was provided
  if (partials && Object.keys(partials).length > 0) {
    result = resolvePartials(result, partials, new Set());
  }

  // Process conditional blocks: {{#if var}}...{{/if}}
  // Iterate until stable to support nested conditionals.
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName: string, block: string) => {
        const value = flat[varName];
        return value !== undefined &&
          value !== null &&
          value !== false &&
          value !== ""
          ? block
          : "";
      },
    );
  }

  // Substitute variables: {{var}}, {{var:type}}, {{var|default}}, {{var:type|default}}
  result = result.replace(
    /\{\{([^>}#/][^}]*?)\}\}/g,
    (match, rawExpr: string) => {
      const expr = rawExpr.trim();
      const pipeIdx = expr.indexOf("|");
      const namePart = pipeIdx !== -1 ? expr.slice(0, pipeIdx).trim() : expr;
      const defaultVal =
        pipeIdx !== -1 ? expr.slice(pipeIdx + 1).trim() : undefined;

      const colonIdx = namePart.indexOf(":");
      const varName =
        colonIdx !== -1 ? namePart.slice(0, colonIdx).trim() : namePart;

      const value = flat[varName];
      if (value !== undefined && value !== null) {
        return Array.isArray(value) ? value.join(", ") : String(value);
      }
      if (defaultVal !== undefined) {
        return defaultVal;
      }
      return match; // leave unreplaced
    },
  );

  return result.replace(/\n{3,}/g, "\n\n").trim();
}
