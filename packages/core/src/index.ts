export { parseTemplate, deriveFunctionName, SUPPORTED_EXTENSIONS } from "./parser.js";
export { resolveIncludes, findTemplate, collectPartials, hasEffectiveVariables } from "./resolver.js";
export { generateFiles } from "./codegen.js";
export { collect, generate } from "./collector.js";
export { renderTemplate, flattenVars } from "./runtime.js";
export type { ParsedTemplate, GenerateOptions, TplConfig, VariableDef, VariableType } from "./types.js";
