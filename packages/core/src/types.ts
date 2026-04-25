export type VariableType = "string" | "number" | "boolean" | "string[]";

export interface VariableDef {
  name: string;
  type: VariableType;
  /** True when the variable has a default value or only appears in {{#if}} blocks */
  optional: boolean;
  /** Default value, present when the template uses {{name|default}} syntax */
  defaultValue?: string;
}

export interface ParsedTemplate {
  filePath: string;
  /** Exact basename before .tpl.<ext>, preserved for generated filenames. */
  sourceStem: string;
  /** camelCase base name derived from the filename, e.g. "welcomeEmail" */
  functionName: string;
  description?: string;
  /** Own variables declared in this template (not inherited from partials) */
  variables: VariableDef[];
  includes: string[];
  rawContent: string;
}

export interface GenerateOptions {
  rootDir: string;
  /** Absolute path to the generated barrel file (e.g. /project/lib/tpl.gen.ts) */
  outputFile: string;
  pattern?: string;
  ignore?: string[];
}

export interface TplConfig {
  /** Relative path to the generated barrel file. Defaults to "lib/tpl.gen.ts". */
  output?: string;
  pattern?: string;
  ignore?: string[];
}

export type CheckIssueKind = "missing" | "changed" | "stale";

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
