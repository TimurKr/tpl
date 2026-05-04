export { generateFiles } from "./codegen.js";
export { check, collect, generate } from "./collector.js";
export {
  deriveFunctionName,
  deriveSourceStem,
  parseTemplate,
  SUPPORTED_EXTENSIONS,
} from "./parser.js";
export {
  collectPartials,
  findTemplate,
  hasEffectiveVariables,
  resolveIncludes,
} from "./resolver.js";
export { flattenVars, renderTemplate } from "./runtime.js";
export type {
  CheckIssue,
  CheckIssueKind,
  CheckResult,
  GenerateOptions,
  ImportSpecifierExtension,
  ParsedTemplate,
  TplConfig,
  VariableDef,
  VariableType,
} from "./types.js";
