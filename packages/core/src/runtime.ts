/**
 * TPL runtime — used by generated prompt files at runtime.
 *
 * Supports:
 *   {{var}}              — required variable substitution
 *   {{var:type}}         — typed variable (type ignored at runtime, used for codegen)
 *   {{var|default}}      — optional with default value
 *   {{var:type|default}} — typed optional with default
 *   {{#if var}}...{{/if}} — conditional block (renders when var is truthy)
 *   {{#switch v}}...{{/switch}} — first matching {{#case "lit"}}…{{/case}}; {{#case ""}} matches undefined/null. Optional {{#default}}…{{/default}}
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

const IF_OPEN_RE = /\{\{#if\s+(\w+)\}\}/g;
const IF_TOKEN_RE = /\{\{#if\s+\w+\}\}|\{\{\/if\}\}/g;
const IF_CLOSE = "{{/if}}";

const SWITCH_OPEN_RE = /\{\{#switch\s+(\w+)\}\}/g;
const SWITCH_TOKEN_RE = /\{\{#switch\s+\w+\}\}|\{\{\/switch\}\}/g;
const SWITCH_CLOSE = "{{/switch}}";

const CASE_OPEN_RE = /^\{\{#case\s+(?:"([^"]*)"|'([^']*)'|(\w+))\s*\}\}/;
const CASE_CLOSE = "{{/case}}";
const DEFAULT_OPEN = "{{#default}}";
const DEFAULT_CLOSE = "{{/default}}";

function switchDiscriminantMatches(value: unknown, literal: string): boolean {
  if (value === undefined || value === null) {
    return literal === "";
  }
  return String(value) === literal;
}

/** Find end index of `{{/case}}` matching the opening `#case` at `bodyStart` (nested cases balanced). */
function findClosingCaseEnd(s: string, bodyStart: number): number {
  let i = bodyStart;
  let depth = 1;
  while (i < s.length) {
    const slice = s.slice(i);
    const caseOpen = slice.match(CASE_OPEN_RE);
    if (caseOpen) {
      depth++;
      i += caseOpen[0].length;
      continue;
    }
    if (slice.startsWith(CASE_CLOSE)) {
      depth--;
      if (depth === 0) return i;
      i += CASE_CLOSE.length;
      continue;
    }
    i++;
  }
  return -1;
}

/** Find end index of `{{/default}}` matching nested `{{#default}}`. */
function findClosingDefaultEnd(s: string, bodyStart: number): number {
  let i = bodyStart;
  let depth = 1;
  while (i < s.length) {
    const slice = s.slice(i);
    if (slice.startsWith(DEFAULT_OPEN)) {
      depth++;
      i += DEFAULT_OPEN.length;
      continue;
    }
    if (slice.startsWith(DEFAULT_CLOSE)) {
      depth--;
      if (depth === 0) return i;
      i += DEFAULT_CLOSE.length;
      continue;
    }
    i++;
  }
  return -1;
}

type SwitchBranch = { literal: string | null; body: string };

/**
 * Parse the inner of `{{#switch v}}` … `{{/switch}}` into ordered case/default branches.
 */
function parseSwitchBranches(inner: string): SwitchBranch[] {
  const branches: SwitchBranch[] = [];
  let pos = 0;
  const len = inner.length;

  const skipWs = () => {
    while (pos < len && /\s/.test(inner[pos] ?? "")) pos++;
  };

  while (pos < len) {
    skipWs();
    if (pos >= len) break;

    const slice = inner.slice(pos);
    const caseM = slice.match(CASE_OPEN_RE);
    if (caseM) {
      const lit = caseM[1] ?? caseM[2] ?? caseM[3] ?? "";
      const openLen = caseM[0].length;
      const bodyStart = pos + openLen;
      const closeIdx = findClosingCaseEnd(inner, bodyStart);
      if (closeIdx === -1) break;
      branches.push({
        literal: lit,
        body: inner.slice(bodyStart, closeIdx),
      });
      pos = closeIdx + CASE_CLOSE.length;
      continue;
    }

    if (slice.startsWith(DEFAULT_OPEN)) {
      const bodyStart = pos + DEFAULT_OPEN.length;
      const closeIdx = findClosingDefaultEnd(inner, bodyStart);
      if (closeIdx === -1) break;
      branches.push({
        literal: null,
        body: inner.slice(bodyStart, closeIdx),
      });
      pos = closeIdx + DEFAULT_CLOSE.length;
      continue;
    }

    // Unrecognized tail — stop parsing branches
    break;
  }

  return branches;
}

function findClosingSwitchIndex(input: string, blockStart: number): number {
  SWITCH_TOKEN_RE.lastIndex = blockStart;
  let depth = 1;
  while (true) {
    const token = SWITCH_TOKEN_RE.exec(input);
    if (token === null) break;
    if (token[0] === SWITCH_CLOSE) {
      depth--;
      if (depth === 0) return token.index;
    } else {
      depth++;
    }
  }
  return -1;
}

/**
 * Render `{{#switch var}}...{{/switch}}`: first matching `{{#case "x"}}` / `{{#case 'x'}}` / `{{#case x}}`,
 * else `{{#default}}`. Nested `#switch` inside the chosen branch is expanded recursively.
 * Used together with `renderConditionals` in a loop until stable so that
 * switches inside falsy `#if` branches are never expanded, while `#if` inside
 * chosen `case` bodies still run after the switch is resolved.
 */
function renderSwitchBlocks(
  input: string,
  flat: Record<string, unknown>,
): string {
  let result = "";
  let cursor = 0;
  while (cursor < input.length) {
    SWITCH_OPEN_RE.lastIndex = cursor;
    const open = SWITCH_OPEN_RE.exec(input);
    if (!open) {
      result += input.slice(cursor);
      break;
    }
    result += input.slice(cursor, open.index);

    const varName = open[1] as string;
    const blockStart = open.index + open[0].length;
    const closeIdx = findClosingSwitchIndex(input, blockStart);
    if (closeIdx === -1) {
      result += input.slice(open.index);
      break;
    }

    const inner = input.slice(blockStart, closeIdx);
    const disc = flat[varName];
    const branches = parseSwitchBranches(inner);

    let chosen: string | null = null;
    for (const br of branches) {
      if (br.literal !== null) {
        if (switchDiscriminantMatches(disc, br.literal)) {
          chosen = br.body;
          break;
        }
      }
    }
    if (chosen === null) {
      for (const br of branches) {
        if (br.literal === null) {
          chosen = br.body;
          break;
        }
      }
    }

    if (chosen !== null) {
      result += renderSwitchBlocks(chosen, flat);
    }

    cursor = closeIdx + SWITCH_CLOSE.length;
  }
  return result;
}

/**
 * Render `{{#if var}}...{{/if}}` blocks with proper nesting support.
 *
 * Walks the input left-to-right; for every opening tag it scans forward with
 * a depth counter to find the matching closing tag, then recurses into the
 * inner block when the variable is truthy.
 */
function renderConditionals(
  input: string,
  flat: Record<string, unknown>,
): string {
  let result = "";
  let cursor = 0;
  while (cursor < input.length) {
    IF_OPEN_RE.lastIndex = cursor;
    const open = IF_OPEN_RE.exec(input);
    if (!open) {
      result += input.slice(cursor);
      break;
    }
    result += input.slice(cursor, open.index);

    const varName = open[1] as string;
    const blockStart = open.index + open[0].length;

    IF_TOKEN_RE.lastIndex = blockStart;
    let depth = 1;
    let closeIdx = -1;
    while (true) {
      const token = IF_TOKEN_RE.exec(input);
      if (token === null) break;
      if (token[0] === IF_CLOSE) {
        depth--;
        if (depth === 0) {
          closeIdx = token.index;
          break;
        }
      } else {
        depth++;
      }
    }

    if (closeIdx === -1) {
      // Unmatched open tag — leave the rest of the input untouched.
      result += input.slice(open.index);
      break;
    }

    const value = flat[varName];
    const truthy =
      value !== undefined && value !== null && value !== false && value !== "";
    if (truthy) {
      const inner = input.slice(blockStart, closeIdx);
      result += renderConditionals(inner, flat);
    }
    cursor = closeIdx + IF_CLOSE.length;
  }
  return result;
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
  if (typeof content !== "string") {
    throw new TypeError(
      'TPL template source must be a string. If this came from a generated template import, your bundler may not be loading .tpl.* files as text. Use templateSource: "filesystem" or configure a text/raw-file loader.',
    );
  }

  const flat = flattenVars(vars);

  // Strip frontmatter from the raw file content
  let result = stripFrontmatter(content);

  // Resolve partial includes if a partials map was provided
  if (partials && Object.keys(partials).length > 0) {
    result = resolvePartials(result, partials, new Set());
  }

  // Alternate conditionals and switches until stable so:
  // - `{{#if false}}...{{#switch}}...{{/if}}` never expands the inner switch
  // - `{{#switch}}...{{#case}}{{#if}}...{{/if}}...` still runs `#if` after case is chosen
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = renderConditionals(result, flat);
    result = renderSwitchBlocks(result, flat);
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
