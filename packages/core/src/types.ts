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
  /** Absolute path to the output directory (e.g. /project/lib/tpl) */
  outputDir: string;
  pattern?: string;
  ignore?: string[];
}

export interface TplConfig {
  /** Relative path to the output directory. Defaults to "lib/tpl". */
  output?: string;
  pattern?: string;
  ignore?: string[];
}
