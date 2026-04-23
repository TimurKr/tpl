export { parseTemplate, deriveFunctionName, SUPPORTED_EXTENSIONS } from "./parser.js";
export { resolveIncludes } from "./resolver.js";
export { generateFiles } from "./codegen.js";
export { collect, generate } from "./collector.js";
export type { ParsedTemplate, GenerateOptions, TplConfig } from "./types.js";
