export type VariableType = "string" | "number" | "boolean" | "string[]";

export interface VariableDef {
  name: string;
  type: VariableType;
  /** True when the variable has a default value or only appears in {{#if}} blocks */
  optional: boolean;
  /** Default value, present when the template uses {{name|default}} syntax */
  defaultValue?: string;
}

export interface IncludeDef {
  path: string;
  alias?: string;
}

export interface ParsedTemplate {
  filePath: string;
  /** Exact basename before .tpl.<ext>, preserved for generated filenames. */
  sourceStem: string;
  /** camelCase generated name, derived from the rewritten template path */
  functionName: string;
  /** Nested prompt object path, e.g. ["features", "auth", "welcomeEmail"]. */
  promptPath: string[];
  description?: string;
  /** Own variables declared in this template (not inherited from partials) */
  variables: VariableDef[];
  includes: IncludeDef[];
  rawContent: string;
}

/** File extension used in relative imports between generated `.tpl.gen.ts` files. */
export type ImportSpecifierExtension = "js" | "ts";

export interface GenerateOptions {
  rootDir: string;
  /** Absolute path to the generated barrel file (e.g. /project/lib/tpl.gen.ts) */
  outputFile: string;
  /** Absolute path to ambient declarations for .tpl.* imports. Defaults beside outputFile. */
  typesOutputFile?: string;
  pattern?: string;
  ignore?: string[];
  namespaceAliases?: Record<string, string>;
  /**
   * Extension for relative imports between generated modules (barrel ↔ colocated builders).
   * - `"js"` (default): matches TypeScript emit for `moduleResolution` Node16/NodeNext — `./x.js` resolves to `x.ts`.
   * - `"ts"`: use explicit `.ts` specifiers for bundlers (e.g. some Turbopack setups) that do not rewrite `.js` → `.ts`.
   */
  importSpecifierExtension?: ImportSpecifierExtension;
  /**
   * Path to an ES module (relative to project root) that transforms each generated file
   * before write / check. Must export `default` or `transformGenerated` as
   * `(filePath, content, { rootDir }) => string`. Use plain `.mjs`/`.cjs` so Node can load it.
   * `tpl check` runs the same transform as `tpl generate` so drift detection matches your pipeline.
   */
  postprocess?: string;
}

export interface TplConfig {
  /** Relative path to the generated barrel file. Defaults to "lib/tpl.gen.ts". */
  output?: string;
  /** Relative path to ambient declarations. Defaults beside output as "tpl.d.ts". */
  typesOutput?: string;
  pattern?: string;
  ignore?: string[];
  namespaceAliases?: Record<string, string>;
  /** Same as {@link GenerateOptions.importSpecifierExtension}. */
  importSpecifierExtension?: ImportSpecifierExtension;
  /** Same as {@link GenerateOptions.postprocess}. */
  postprocess?: string;
}

export type CheckIssueKind = "missing" | "changed" | "stale";

export type GenerateIssueKind = "name-collision" | "include-error";

export interface GenerateIssue {
  kind: GenerateIssueKind;
  filePath: string;
}

export interface GenerateResult {
  outputFile: string;
  count: number;
  templates: ParsedTemplate[];
  issues: GenerateIssue[];
}

export interface CheckIssue {
  kind: CheckIssueKind;
  filePath: string;
}

export interface CheckResult {
  ok: boolean;
  outputFile: string;
  count: number;
  templates: ParsedTemplate[];
  issues: CheckIssue[];
}
