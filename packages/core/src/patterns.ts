/**
 * Shared regex patterns used across parser, resolver, and runtime.
 * Defined once to prevent divergence when the pattern needs updating.
 */

/** Matches {{> partialName}} include directives. */
export const INCLUDE_RE = /\{\{>\s*([^}]+)\}\}/g;
