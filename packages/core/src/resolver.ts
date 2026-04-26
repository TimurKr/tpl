import { dirname, resolve } from "node:path";
import { INCLUDE_RE, parseIncludeExpression } from "./patterns.js";
import type { IncludeDef, ParsedTemplate } from "./types.js";

function isRelativeInclude(includeName: string): boolean {
  return includeName.startsWith("./") || includeName.startsWith("../");
}

function resolveContent(
  content: string,
  allTemplates: Map<string, ParsedTemplate>,
  visited: Set<string>,
  origin: ParsedTemplate,
): string {
  return content.replace(INCLUDE_RE, (_, rawName: string) => {
    const include = parseIncludeExpression(rawName);

    const resolved = findTemplate(allTemplates, include, origin);
    if (!resolved) {
      throw new Error(
        `Include '{{> ${include.path}}}' in '${origin.filePath}' could not be resolved. ` +
          `Includes must use relative paths like '{{> ./partial}}' or '{{> ../shared/base}}'.`,
      );
    }

    if (visited.has(resolved.functionName)) {
      throw new Error(
        `Circular include detected: '${include.path}' is already in the resolution chain ` +
          `[${[...visited].join(" → ")} → ${resolved.functionName}]`,
      );
    }

    const nextVisited = new Set(visited);
    nextVisited.add(resolved.functionName);

    return resolveContent(
      resolved.rawContent,
      allTemplates,
      nextVisited,
      resolved,
    ).trim();
  });
}

/**
 * Find a template by include reference relative to the including template.
 */
export function findTemplate(
  allTemplates: Map<string, ParsedTemplate>,
  include: IncludeDef,
  fromTemplate: ParsedTemplate,
): ParsedTemplate | undefined {
  const includeName = include.path;
  if (!isRelativeInclude(includeName)) {
    return undefined;
  }

  const base = resolve(dirname(fromTemplate.filePath), includeName);
  const candidates = [
    `${base}.tpl.md`,
    `${base}.tpl.mdx`,
    `${base}.tpl.txt`,
    `${base}.tpl.html`,
  ];

  for (const template of allTemplates.values()) {
    if (candidates.includes(resolve(template.filePath))) {
      return template;
    }
  }

  return undefined;
}

export function resolveIncludes(
  template: ParsedTemplate,
  allTemplates: Map<string, ParsedTemplate>,
): string {
  const visited = new Set<string>([template.functionName]);
  return resolveContent(template.rawContent, allTemplates, visited, template);
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
  visited: Set<string> = new Set(),
): boolean {
  if (visited.has(template.functionName)) return false;
  if (template.variables.length > 0) return true;
  const next = new Set([...visited, template.functionName]);
  for (const include of template.includes) {
    const partial = findTemplate(allTemplates, include, template);
    if (partial && hasEffectiveVariables(partial, allTemplates, next))
      return true;
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
  allTemplates: Map<string, ParsedTemplate>,
): ParsedTemplate[] {
  const collected: ParsedTemplate[] = [];
  const seen = new Set<string>();

  function traverse(t: ParsedTemplate, visited: Set<string>): void {
    for (const include of t.includes) {
      const partial = findTemplate(allTemplates, include, t);
      if (!partial) {
        throw new Error(
          `Include '{{> ${include.path}}}' in '${t.filePath}' could not be resolved. ` +
            `Includes must use relative paths like '{{> ./partial}}' or '{{> ../shared/base}}'.`,
        );
      }
      if (visited.has(partial.functionName)) {
        throw new Error(
          `Circular include detected: '${include.path}' is already in the resolution chain ` +
            `[${[...visited].join(" → ")} → ${partial.functionName}]`,
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
