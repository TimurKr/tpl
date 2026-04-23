import { mkdir, writeFile, readdir, rm } from "fs/promises";
import { join } from "path";
import fg from "fast-glob";
import { parseTemplate } from "./parser.js";
import { generateFiles } from "./codegen.js";
import type { ParsedTemplate, GenerateOptions } from "./types.js";

const DEFAULT_PATTERN = "**/*.tpl.{md,mdx,txt,html}";
const DEFAULT_IGNORE = ["**/node_modules/**", "**/dist/**", "**/.git/**"];

export async function collect(options: GenerateOptions): Promise<ParsedTemplate[]> {
  const pattern = options.pattern ?? DEFAULT_PATTERN;
  const ignore = [...DEFAULT_IGNORE, ...(options.ignore ?? [])];

  const files = await fg(pattern, {
    cwd: options.rootDir,
    absolute: true,
    ignore,
  });

  return Promise.all(files.map((f) => parseTemplate(f, options.rootDir)));
}

export async function generate(
  options: GenerateOptions
): Promise<{ outputDir: string; count: number; templates: ParsedTemplate[] }> {
  const templates = await collect(options);

  const allTemplates = new Map<string, ParsedTemplate>(
    templates.map((t) => [t.functionName, t])
  );

  const files = generateFiles(templates, allTemplates, options);

  // Clean out stale files before writing so deleted prompts don't linger
  await mkdir(options.outputDir, { recursive: true });
  const existing = await readdir(options.outputDir).catch(() => [] as string[]);
  const toDelete = existing.filter(
    (f) => f.endsWith(".ts") && !files.has(f)
  );
  await Promise.all(
    toDelete.map((f) => rm(join(options.outputDir, f), { force: true }))
  );

  // Write all generated files
  await Promise.all(
    Array.from(files.entries()).map(([filename, content]) =>
      writeFile(join(options.outputDir, filename), content, "utf-8")
    )
  );

  return { outputDir: options.outputDir, count: templates.length, templates };
}
