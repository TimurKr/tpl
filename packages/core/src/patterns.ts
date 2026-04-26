/**
 * Shared regex patterns used across parser, resolver, and runtime.
 * Defined once to prevent divergence when the pattern needs updating.
 */

/** Matches {{> ./partial}} include directives. */
export const INCLUDE_RE = /\{\{>\s*([^}]+)\}\}/g;

/** Parse "./path" or "./path as localName" from an include directive. */
export function parseIncludeExpression(expr: string): {
  path: string;
  alias?: string;
} {
  const raw = expr.trim();
  const match = raw.match(/^(\S+)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
  if (!match?.[1]) {
    throw new Error(
      `Invalid include expression '${expr}'. Use '{{> ./path}}' or '{{> ./path as localName}}'.`,
    );
  }

  return match[2] ? { path: match[1], alias: match[2] } : { path: match[1] };
}
