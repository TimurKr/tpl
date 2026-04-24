import type { ParsedTemplate } from "./types.js";
import { INCLUDE_RE } from "./patterns.js";

/**
 * Convert an include reference (which may be a path stem like "shared/base-persona"
 * or a bare name like "base-persona" or "basePersona") to the camelCase function name
 * that tpl derives from file stems.
 */
function includeNameToFunctionName(includeName: string): string {
  // Take the last path segment (so "shared/base-persona" → "base-persona")
  const stem = includeName.split("/").pop() ?? includeName;
  // Convert kebab-case to camelCase (no-op if already camelCase)
  return stem.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function resolveContent(
  content: string,
  allTemplates: Map<string, ParsedTemplate>,
  visited: Set<string>,
  originName: string
): string {
  return content.replace(INCLUDE_RE, (_, rawName: string) => {
    const includeName = rawName.trim();

    const resolved = findTemplate(allTemplates, includeName);
    if (!resolved) {
      throw new Error(
        `Include '{{> ${includeName}}}' in '${originName}' could not be resolved. ` +
          `No template found for '${includeName}'.`
      );
    }

    if (visited.has(resolved.functionName)) {
      throw new Error(
        `Circular include detected: '${includeName}' is already in the resolution chain ` +
          `[${[...visited].join(" → ")} → ${resolved.functionName}]`
      );
    }

    const nextVisited = new Set(visited);
    nextVisited.add(resolved.functionName);

    return resolveContent(resolved.rawContent, allTemplates, nextVisited, resolved.filePath).trim();
  });
}

/**
 * Find a template by include reference.
 *
 * Resolution order:
 *  1. Path-suffix match: "shared/base-persona" matches a file ending with
 *     "shared/base-persona.tpl.md" (backward-compatible).
 *  2. Name-only match: "base-persona" or "basePersona" matches the first template
 *     whose derived function name equals the camelCase version of the stem.
 *     This lets you write {{> basePersona}} instead of {{> src/shared/base-persona}}.
 *
 * Because names must be unique across the project (collisions are flagged as errors),
 * name-only references are unambiguous in a healthy codebase.
 */
export function findTemplate(
  allTemplates: Map<string, ParsedTemplate>,
  includeName: string
): ParsedTemplate | undefined {
  // 1. Path-suffix match (full or partial path, backward-compatible)
  for (const template of allTemplates.values()) {
    const relPath = template.filePath.replace(/\\/g, "/");
    const suffixes = [
      `${includeName}.tpl.md`,
      `${includeName}.tpl.mdx`,
      `${includeName}.tpl.txt`,
      `${includeName}.tpl.html`,
    ];
    if (suffixes.some((s) => relPath.endsWith(s) || relPath === s)) {
      return template;
    }
  }

  // 2. Name-only match: convert the reference to a camelCase function name and compare
  const targetFnName = includeNameToFunctionName(includeName);
  for (const template of allTemplates.values()) {
    if (template.functionName === targetFnName) {
      return template;
    }
  }

  return undefined;
}

export function resolveIncludes(
  template: ParsedTemplate,
  allTemplates: Map<string, ParsedTemplate>
): string {
  const visited = new Set<string>([template.functionName]);
  return resolveContent(template.rawContent, allTemplates, visited, template.filePath);
}

/**
 * Returns true if this template — or any template in its transitive include
 * tree — declares at least one variable. Used by codegen to decide whether a
 * partial should be exposed in the parent interface (has vars → expose) or
 * auto-rendered with no caller involvement (no vars → hide).
 */
export function hasEffectiveVariables(
  template: ParsedTemplate,
  allTemplates: Map<string, ParsedTemplate>,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(template.functionName)) return false;
  if (template.variables.length > 0) return true;
  const next = new Set([...visited, template.functionName]);
  for (const includeName of template.includes) {
    const partial = findTemplate(allTemplates, includeName);
    if (partial && hasEffectiveVariables(partial, allTemplates, next)) return true;
  }
  return false;
}

/**
 * Collect all transitively included partial templates, in depth-first order.
 * Each partial appears at most once (deduplication by function name).
 * Throws on circular includes or missing templates — same validation as resolveIncludes.
 */
export function collectPartials(
  template: ParsedTemplate,
  allTemplates: Map<string, ParsedTemplate>
): ParsedTemplate[] {
  const collected: ParsedTemplate[] = [];
  const seen = new Set<string>();

  function traverse(t: ParsedTemplate, visited: Set<string>): void {
    for (const includeName of t.includes) {
      const partial = findTemplate(allTemplates, includeName);
      if (!partial) {
        throw new Error(
          `Include '{{> ${includeName}}}' in '${t.filePath}' could not be resolved. ` +
            `No template found for '${includeName}'.`
        );
      }
      if (visited.has(partial.functionName)) {
        throw new Error(
          `Circular include detected: '${includeName}' is already in the resolution chain ` +
            `[${[...visited].join(" → ")} → ${partial.functionName}]`
        );
      }
      if (!seen.has(partial.functionName)) {
        seen.add(partial.functionName);
        collected.push(partial);
        traverse(partial, new Set([...visited, partial.functionName]));
      }
    }
  }

  traverse(template, new Set([template.functionName]));
  return collected;
}
