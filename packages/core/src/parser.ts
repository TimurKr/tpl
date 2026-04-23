import { readFile } from "fs/promises";
import { basename } from "path";
import matter from "gray-matter";
import type { ParsedTemplate } from "./types.js";

const VARIABLE_RE = /\{\{([^>}][^}]*)\}\}/g;
const INCLUDE_RE = /\{\{>\s*([^}]+)\}\}/g;

export function deriveFunctionName(filePath: string): string {
  const base = basename(filePath);
  const stem = base.endsWith(".tpl.md")
    ? base.slice(0, -".tpl.md".length)
    : base;
  return stem.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export async function parseTemplate(
  filePath: string,
  _rootDir: string
): Promise<ParsedTemplate> {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);

  const variables: string[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(VARIABLE_RE)) {
    const name = (match[1] ?? "").trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      variables.push(name);
    }
  }

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
