import { readFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import matter from "gray-matter";
import { INCLUDE_RE, parseIncludeExpression } from "./patterns.js";
import type { ParsedTemplate, VariableDef, VariableType } from "./types.js";

// Matches {{var}}, {{var:type}}, {{var|default}}, {{var:type|default}}
// Does NOT match {{> include}}, {{#if}}, {{/if}}, {{#switch}}, case/default tags
const VARIABLE_RE = /\{\{([^>}#/][^}]*?)\}\}/g;
// Matches {{#if varName}} to detect conditional variables
const CONDITIONAL_RE = /\{\{#if\s+(\w+)\}\}/g;
// Matches switch tags and branches so discriminants can infer literal unions.
const SWITCH_RE = /\{\{#switch\s+(\w+)\}\}/g;
const SWITCH_TOKEN_RE =
  /\{\{#switch\s+(\w+)\}\}|\{\{#case\s+([^}]+?)\}\}|\{\{#default\s*\}\}|\{\{\/switch\}\}/g;

/** Supported file extensions for .tpl.* files */
export const SUPPORTED_EXTENSIONS = ["md", "mdx", "txt", "html"] as const;

export function deriveSourceStem(filePath: string): string {
  const base = basename(filePath);
  // Strip .tpl.<ext> for any supported extension
  return base.replace(/\.tpl\.[^.]+$/, "");
}

function stripTplExtension(path: string): string {
  return path.replace(/\.tpl\.[^.]+$/, "");
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function toAliasSegments(value: string): string[] {
  return value.split(/[/.]/).filter(Boolean);
}

function applyNamespaceAliases(
  stemPath: string,
  namespaceAliases: Record<string, string> = {},
): string {
  let segments = stemPath.split("/").filter(Boolean);

  for (const [from, to] of Object.entries(namespaceAliases)) {
    const fromSegments = from.split("/").filter(Boolean);
    const toSegments = toAliasSegments(to);
    if (fromSegments.length === 0) continue;

    if (fromSegments.length === 1) {
      segments = segments.flatMap((segment) =>
        segment === fromSegments[0] ? toSegments : [segment],
      );
      continue;
    }

    const matchesPrefix = fromSegments.every(
      (segment, index) => segments[index] === segment,
    );
    if (matchesPrefix) {
      segments = [...toSegments, ...segments.slice(fromSegments.length)];
    }
  }

  return segments.join("/");
}

function toWords(segment: string): string[] {
  return segment.split(/[^a-zA-Z0-9]+/).filter(Boolean);
}

function toPascal(words: string[]): string {
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function applyIndexTemplateDefault(segments: string[]): string[] {
  const last = segments.at(-1);
  if (last !== "index" || segments.length <= 1) return segments;

  return segments.slice(0, -1);
}

export function derivePromptPath(
  filePath: string,
  rootDir?: string,
  namespaceAliases: Record<string, string> = {},
): string[] {
  const pathForName = rootDir
    ? toPosixPath(relative(rootDir, filePath))
    : basename(filePath);
  const stemPath = applyNamespaceAliases(
    stripTplExtension(pathForName),
    namespaceAliases,
  );
  const segments = stemPath.split("/").filter(Boolean);
  const meaningfulSegments =
    segments[0] === "src" ? segments.slice(1) : segments;
  const namedSegments = applyIndexTemplateDefault(meaningfulSegments);
  const promptPath = namedSegments
    .map((segment) => {
      const [first, ...rest] = toWords(segment);
      return first
        ? `${first.charAt(0).toLowerCase()}${first.slice(1)}${toPascal(rest)}`
        : "";
    })
    .filter(Boolean);

  return promptPath.length > 0 ? promptPath : [deriveSourceStem(filePath)];
}

export function deriveFunctionName(
  filePath: string,
  rootDir?: string,
  namespaceAliases: Record<string, string> = {},
): string {
  const promptPath = derivePromptPath(filePath, rootDir, namespaceAliases);
  const [first, ...rest] = promptPath;
  return first ? `${first}${toPascal(rest)}` : deriveSourceStem(filePath);
}

/**
 * Parse a variable expression like:
 *   "name"             → { name, type: "string", optional: false }
 *   "name:number"      → { name, type: "number", optional: false }
 *   "name|default"     → { name, type: "string", optional: true, defaultValue }
 *   "name:number|0"    → { name, type: "number", optional: true, defaultValue: "0" }
 */
function parseVarExpr(expr: string): VariableDef {
  const raw = expr.trim();
  const pipeIdx = raw.indexOf("|");
  const hasDefault = pipeIdx !== -1;
  const namePart = hasDefault ? raw.slice(0, pipeIdx).trim() : raw;
  const defaultValue = hasDefault ? raw.slice(pipeIdx + 1).trim() : undefined;

  const colonIdx = namePart.indexOf(":");
  const name = colonIdx !== -1 ? namePart.slice(0, colonIdx).trim() : namePart;
  const typeStr =
    colonIdx !== -1 ? namePart.slice(colonIdx + 1).trim() : "string";

  const VALID_TYPES: VariableType[] = [
    "string",
    "number",
    "boolean",
    "string[]",
  ];
  const type: VariableType = VALID_TYPES.includes(typeStr as VariableType)
    ? (typeStr as VariableType)
    : "string";

  return defaultValue !== undefined
    ? { name, type, optional: true, defaultValue }
    : { name, type, optional: false };
}

interface SwitchUsage {
  name: string;
  cases: string[];
  hasDefault: boolean;
}

function parseCaseLiteral(raw: string): string {
  const value = raw.trim();
  const quote = value[0];
  if (
    (quote === `"` || quote === `'`) &&
    value.length >= 2 &&
    value[value.length - 1] === quote
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function formatStringLiteralUnion(cases: string[]): string {
  return cases.map((value) => JSON.stringify(value)).join(" | ");
}

function collectSwitchUsages(content: string): SwitchUsage[] {
  const usages: SwitchUsage[] = [];
  const stack: Array<{
    name: string;
    cases: Set<string>;
    hasDefault: boolean;
  }> = [];

  for (const match of content.matchAll(SWITCH_TOKEN_RE)) {
    const token = match[0];
    const switchName = match[1]?.trim();
    const caseValue = match[2];

    if (switchName) {
      stack.push({ name: switchName, cases: new Set(), hasDefault: false });
      continue;
    }

    const current = stack.at(-1);
    if (!current) continue;

    if (caseValue !== undefined) {
      current.cases.add(parseCaseLiteral(caseValue));
      continue;
    }

    if (token.startsWith("{{#default")) {
      current.hasDefault = true;
      continue;
    }

    if (token === "{{/switch}}") {
      const completed = stack.pop();
      if (!completed) continue;
      usages.push({
        name: completed.name,
        cases: [...completed.cases],
        hasDefault: completed.hasDefault,
      });
    }
  }

  return usages;
}

export async function parseTemplate(
  filePath: string,
  rootDir: string,
  namespaceAliases: Record<string, string> = {},
): Promise<ParsedTemplate> {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);

  // Collect variables that appear in {{#if var}} → these are optional
  const conditionalVars = new Set<string>();
  for (const match of content.matchAll(CONDITIONAL_RE)) {
    const name = (match[1] ?? "").trim();
    if (name) conditionalVars.add(name);
  }

  const switchUsages = collectSwitchUsages(content);
  const switchDiscriminants = new Set<string>();
  const switchCases = new Map<string, Set<string>>();
  const switchDefaultCounts = new Map<string, number>();
  const switchUsageCounts = new Map<string, number>();
  for (const match of content.matchAll(SWITCH_RE)) {
    const name = (match[1] ?? "").trim();
    if (name) switchDiscriminants.add(name);
  }
  for (const usage of switchUsages) {
    switchDiscriminants.add(usage.name);
    switchUsageCounts.set(
      usage.name,
      (switchUsageCounts.get(usage.name) ?? 0) + 1,
    );
    if (usage.hasDefault) {
      switchDefaultCounts.set(
        usage.name,
        (switchDefaultCounts.get(usage.name) ?? 0) + 1,
      );
    }
    const cases = switchCases.get(usage.name) ?? new Set<string>();
    for (const value of usage.cases) cases.add(value);
    switchCases.set(usage.name, cases);
  }

  // Collect all non-include, non-conditional variable expressions
  const seen = new Map<string, VariableDef>();
  for (const match of content.matchAll(VARIABLE_RE)) {
    const expr = (match[1] ?? "").trim();
    if (!expr) continue;

    const def = parseVarExpr(expr);
    if (!def.name) continue;

    if (!seen.has(def.name)) {
      // If the var only appears in {{#if}}, force optional
      if (conditionalVars.has(def.name) && !def.optional) {
        seen.set(def.name, { ...def, optional: true });
      } else {
        seen.set(def.name, def);
      }
    }
  }

  // Condition-only variables are boolean flags. If the same variable also appears
  // as {{var}} or {{var:type}}, keep that declaration's type and mark it optional.
  for (const condVar of conditionalVars) {
    if (!seen.has(condVar)) {
      seen.set(condVar, { name: condVar, type: "boolean", optional: true });
    }
  }

  // {{#switch discriminant}} — switch-only discriminants infer a literal union
  // from their cases. A switch with a default branch can be omitted.
  for (const d of switchDiscriminants) {
    if (!seen.has(d)) {
      const cases = [...(switchCases.get(d) ?? [])];
      const type =
        cases.length > 0 ? formatStringLiteralUnion(cases) : "string";
      const usageCount = switchUsageCounts.get(d) ?? 0;
      const defaultCount = switchDefaultCounts.get(d) ?? 0;
      seen.set(d, {
        name: d,
        type,
        optional: usageCount > 0 && defaultCount === usageCount,
      });
    }
  }

  const variables = [...seen.values()];

  const includes: string[] = [];
  for (const match of content.matchAll(INCLUDE_RE)) {
    const inc = (match[1] ?? "").trim();
    if (inc) includes.push(inc);
  }

  const description =
    typeof data.description === "string" ? data.description : undefined;
  const promptPath = derivePromptPath(filePath, rootDir, namespaceAliases);

  const base: ParsedTemplate = {
    filePath,
    sourceStem: deriveSourceStem(filePath),
    functionName: deriveFunctionName(filePath, rootDir, namespaceAliases),
    promptPath,
    variables,
    includes: includes.map(parseIncludeExpression),
    rawContent: content.trim(),
  };

  return description !== undefined ? { ...base, description } : base;
}
