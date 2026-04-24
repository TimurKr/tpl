import { readFile } from "fs/promises";
import { basename } from "path";
import matter from "gray-matter";
import type { ParsedTemplate, VariableDef, VariableType } from "./types.js";
import { INCLUDE_RE } from "./patterns.js";

// Matches {{var}}, {{var:type}}, {{var|default}}, {{var:type|default}}
// Does NOT match {{> include}}, {{#if}}, {{/if}}
const VARIABLE_RE = /\{\{([^>}#/][^}]*?)\}\}/g;
// Matches {{#if varName}} to detect conditional variables
const CONDITIONAL_RE = /\{\{#if\s+(\w+)\}\}/g;

/** Supported file extensions for .tpl.* files */
export const SUPPORTED_EXTENSIONS = ["md", "mdx", "txt", "html"] as const;

export function deriveFunctionName(filePath: string): string {
  const base = basename(filePath);
  // Strip .tpl.<ext> for any supported extension
  const stem = base.replace(/\.tpl\.[^.]+$/, "");
  return stem.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
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
  const typeStr = colonIdx !== -1 ? namePart.slice(colonIdx + 1).trim() : "string";

  const VALID_TYPES: VariableType[] = ["string", "number", "boolean", "string[]"];
  const type: VariableType = VALID_TYPES.includes(typeStr as VariableType)
    ? (typeStr as VariableType)
    : "string";

  return defaultValue !== undefined
    ? { name, type, optional: true, defaultValue }
    : { name, type, optional: false };
}

export async function parseTemplate(
  filePath: string,
  _rootDir: string
): Promise<ParsedTemplate> {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);

  // Collect variables that appear in {{#if var}} → these are optional
  const conditionalVars = new Set<string>();
  for (const match of content.matchAll(CONDITIONAL_RE)) {
    const name = (match[1] ?? "").trim();
    if (name) conditionalVars.add(name);
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

  // Any variable referenced in {{#if}} but not as {{var}} directly is still optional
  for (const condVar of conditionalVars) {
    if (!seen.has(condVar)) {
      seen.set(condVar, { name: condVar, type: "string", optional: true });
    }
  }

  const variables = [...seen.values()];

  const includes: string[] = [];
  for (const match of content.matchAll(INCLUDE_RE)) {
    const inc = (match[1] ?? "").trim();
    if (inc) includes.push(inc);
  }

  const description =
    typeof data["description"] === "string" ? data["description"] : undefined;

  const base: ParsedTemplate = {
    filePath,
    functionName: deriveFunctionName(filePath),
    variables,
    includes,
    rawContent: content.trim(),
  };

  return description !== undefined ? { ...base, description } : base;
}
