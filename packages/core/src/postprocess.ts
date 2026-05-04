import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type PostprocessContext = { rootDir: string };

export type PostprocessFn = (
  filePath: string,
  content: string,
  ctx: PostprocessContext,
) => string;

/**
 * Load an optional postprocess module from the project root.
 * The module must be plain JS (e.g. `.mjs` or `.cjs`) so Node can import it
 * without a TypeScript loader.
 *
 * Export either:
 * - `export default function (filePath, content, ctx) { return content }`
 * - `export function transformGenerated(filePath, content, ctx) { ... }`
 */
export async function loadPostprocess(
  rootDir: string,
  modulePath: string | undefined,
): Promise<PostprocessFn | null> {
  const trimmed = modulePath?.trim();
  if (!trimmed) return null;

  const absPath = resolve(rootDir, trimmed);
  let mod: Record<string, unknown>;
  try {
    mod = (await import(pathToFileURL(absPath).href)) as Record<
      string,
      unknown
    >;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load tpl postprocess module '${trimmed}' (${absPath}): ${msg}`,
    );
  }

  const fn = mod.default ?? mod.transformGenerated;
  if (typeof fn !== "function") {
    throw new Error(
      `Postprocess module '${trimmed}' must export a default function or named export 'transformGenerated'.`,
    );
  }

  return (filePath, content, ctx) =>
    (fn as (a: string, b: string, c: PostprocessContext) => string)(
      filePath,
      content,
      ctx,
    );
}

export function applyPostprocess(
  files: Map<string, string>,
  fn: PostprocessFn | null,
  rootDir: string,
): Map<string, string> {
  if (!fn) return files;
  const ctx: PostprocessContext = { rootDir };
  const next = new Map<string, string>();
  for (const [filePath, content] of files) {
    next.set(filePath, fn(filePath, content, ctx));
  }
  return next;
}
