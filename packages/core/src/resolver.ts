import type { ParsedTemplate } from "./types.js";

const INCLUDE_RE = /\{\{>\s*([^}]+)\}\}/g;

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

function findTemplate(
  allTemplates: Map<string, ParsedTemplate>,
  includeName: string
): ParsedTemplate | undefined {
  for (const template of allTemplates.values()) {
    const relPath = template.filePath.replace(/\\/g, "/");
    const expectedSuffix = `${includeName}.tpl.md`;
    if (relPath.endsWith(expectedSuffix) || relPath === expectedSuffix) {
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
