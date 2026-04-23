export interface ParsedTemplate {
  filePath: string;
  functionName: string;
  description?: string;
  variables: string[];
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
