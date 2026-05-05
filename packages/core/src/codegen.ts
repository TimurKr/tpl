import { dirname, join, relative } from "node:path";
import { findTemplate, hasEffectiveVariables } from "./resolver.js";
import type {
  GenerateOptions,
  ImportSpecifierExtension,
  IncludeDef,
  ParsedTemplate,
  TemplateSourceMode,
  VariableDef,
} from "./types.js";

function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Convert an OS path to a POSIX-style import path (forward slashes). */
function toImportPath(p: string): string {
  return p.split("\\").join("/");
}

/**
 * Absolute path for the generated module colocated beside its source template.
 */
function generatedFilePath(template: ParsedTemplate): string {
  return join(dirname(template.filePath), `${template.sourceStem}.tpl.gen.ts`);
}

function generatedDtsPath(
  outputFile: string,
  typesOutputFile?: string,
): string {
  return typesOutputFile ?? join(dirname(outputFile), "tpl.d.ts");
}

function buildFunctionName(functionName: string): string {
  const pascalName = toPascalCase(functionName);
  return pascalName.endsWith("Prompt")
    ? `build${pascalName}`
    : `build${pascalName}Prompt`;
}

function legacyBuildFunctionName(functionName: string): string | null {
  const pascalName = toPascalCase(functionName);
  return pascalName.endsWith("Prompt") ? `build${pascalName}Prompt` : null;
}

function importSuffixForGeneratedModules(
  options: GenerateOptions,
): ImportSpecifierExtension {
  return options.importSpecifierExtension === "ts" ? "ts" : "js";
}

function templateSourceMode(options: GenerateOptions): TemplateSourceMode {
  return options.templateSource ?? "filesystem";
}

function templateImportAttribute(options: GenerateOptions): "text" | "raw" {
  return options.templateImportAttributeType === "raw" ? "raw" : "text";
}

function templateSourceRuntimeImports(mode: TemplateSourceMode): string[] {
  if (mode !== "filesystem") return [];
  return [
    `import { readFileSync } from "node:fs";`,
    `import { dirname, join } from "node:path";`,
    `import { fileURLToPath } from "node:url";`,
  ];
}

function templateImportLine(
  identifier: string,
  importPath: string,
  options: GenerateOptions,
): string {
  return `import ${identifier} from "${importPath}" with { type: "${templateImportAttribute(
    options,
  )}" };`;
}

function templateDeclarationLine(
  identifier: string,
  template: ParsedTemplate,
  generatedFile: string,
  options: GenerateOptions,
): string {
  const importPath = relativeImport(dirname(generatedFile), template.filePath);
  switch (templateSourceMode(options)) {
    case "import":
      return templateImportLine(identifier, importPath, options);
    case "filesystem":
      return `const ${identifier} = readFileSync(join(dirname(fileURLToPath(import.meta.url)), ${JSON.stringify(
        importPath,
      )}), "utf8");`;
    case "inline":
      return `const ${identifier} = ${JSON.stringify(template.rawContent)};`;
  }
}

/**
 * Import path from one generated TS file to another, with a configurable extension.
 * Default `.js` matches TypeScript emit for `moduleResolution` "Node16" / "NodeNext".
 * Use `importSpecifierExtension: "ts"` when your bundler needs explicit `.ts` paths.
 */
function generatedRelativeModule(
  fromFile: string,
  toFile: string,
  options: GenerateOptions,
): string {
  const ext = importSuffixForGeneratedModules(options);
  return relativeImport(dirname(fromFile), toFile).replace(/\.ts$/, `.${ext}`);
}

/**
 * Compute the relative import path from one generated file location to a source file,
 * always using forward slashes and always starting with "./" or "../".
 */
function relativeImport(from: string, to: string): string {
  const rel = toImportPath(relative(from, to));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function referenceDirective(fromFile: string, typesFile: string): string {
  return `/// <reference path="${relativeImport(dirname(fromFile), typesFile)}" />`;
}

function isStringLiteralUnion(type: string): boolean {
  return type.startsWith('"');
}

function variableTypeAliasName(
  pascalTemplateName: string,
  variable: VariableDef,
): string | null {
  if (!isStringLiteralUnion(variable.type)) return null;
  return `${pascalTemplateName}${toPascalCase(variable.name)}`;
}

function variableTypeName(
  pascalTemplateName: string,
  variable: VariableDef,
): string {
  return variableTypeAliasName(pascalTemplateName, variable) ?? variable.type;
}

function exportedTypeNames(template: ParsedTemplate): string[] {
  const pascalName = toPascalCase(template.functionName);
  return [
    `${pascalName}Variables`,
    ...template.variables.flatMap((v) => {
      const alias = variableTypeAliasName(pascalName, v);
      return alias ? [alias] : [];
    }),
  ];
}

/**
 * Info about one direct partial dependency of a template.
 * - hasEffectiveVars: true if this partial (or anything in its transitive tree)
 *   declares variables. When true, the partial is exposed in the parent's
 *   interface and the caller must supply its vars. When false, the build
 *   function is called automatically with no arguments.
 */
interface PartialInfo {
  include: IncludeDef;
  partial: ParsedTemplate;
  hasEffectiveVars: boolean;
  buildFnName: string; // e.g. "buildBasePersonaPrompt"
  pascalName: string; // e.g. "BasePersona"
  varsKey: string;
  partialsKey: string;
}

function collectDirectPartialInfos(
  template: ParsedTemplate,
  allTemplates: Map<string, ParsedTemplate>,
): PartialInfo[] {
  const infos: PartialInfo[] = [];
  for (const include of template.includes) {
    const partial = findTemplate(allTemplates, include, template);
    if (!partial) {
      throw new Error(
        `Include '{{> ${include.path}}}' in '${template.filePath}' could not be resolved.`,
      );
    }
    // Detect direct self-reference (deeper cycles are caught by hasEffectiveVariables)
    if (partial.functionName === template.functionName) {
      throw new Error(
        `Circular include detected: '${include.path}' is already in the resolution chain [${template.functionName} → ${partial.functionName}]`,
      );
    }
    infos.push({
      include,
      partial,
      hasEffectiveVars: hasEffectiveVariables(partial, allTemplates),
      buildFnName: buildFunctionName(partial.functionName),
      pascalName: toPascalCase(partial.functionName),
      varsKey: include.alias ?? partial.functionName,
      partialsKey: include.alias ?? include.path,
    });
  }
  return infos;
}

/**
 * Generate the content for a single prompt file (e.g. welcomeEmail.ts).
 *
 * Each file only knows about its direct partial dependencies. For each direct
 * partial:
 *   - If it has effective variables (own or transitive): exposed as a typed
 *     nested field in the interface, its build function is called with
 *     vars.partialName.
 *   - If it has NO effective variables: auto-rendered by calling its build
 *     function with no arguments; the caller never sees it.
 *
 * This means interfaces only contain what the caller actually needs to supply,
 * and each build function delegates to the build functions of its includes —
 * forming a proper recursive call chain instead of a flat partials map.
 */
function generateSinglePromptFile(
  template: ParsedTemplate,
  allTemplates: Map<string, ParsedTemplate>,
  rootDir: string,
  generatedFile: string,
  typesFile: string,
  options: GenerateOptions,
): string {
  const { functionName, description, variables, filePath } = template;
  const pascalName = toPascalCase(functionName);
  const buildFnName = buildFunctionName(functionName);
  const legacyBuildFnName = legacyBuildFunctionName(functionName);
  const interfaceName = `${pascalName}Variables`;
  const relSource = toImportPath(relative(rootDir, filePath));
  const sourceMode = templateSourceMode(options);

  // Gather direct partial info — may throw on circular/missing includes
  let partialInfos: PartialInfo[];
  try {
    partialInfos = collectDirectPartialInfos(template, allTemplates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // The generated file uses @ts-expect-error on a valid line, producing an
    // "Unused directive" TS error that surfaces the problem in the IDE.
    return [
      referenceDirective(generatedFile, typesFile),
      `// AUTO-GENERATED by tpl — do not edit`,
      `// Source: ${relSource}`,
      ...syntaxCommentLines(),
      ``,
      `// ⚠️  TEMPLATE INCLUDE ERROR`,
      `// ${msg}`,
      `// Fix the {{> ...}} reference in your template, then re-run tpl generate.`,
      ``,
      `// @ts-expect-error ⚠️ template include error — the line below is intentionally valid so this directive errors`,
      `export function ${buildFnName}(): string { return ""; }`,
      ``,
    ].join("\n");
  }

  // Split out partials that need caller-supplied vars.
  const exposedPartials = partialInfos.filter((p) => p.hasEffectiveVars);

  // Does this template as a whole need a vars argument?
  const hasOwnVars = variables.length > 0;
  const hasExposedPartials = exposedPartials.length > 0;
  const needsVars = hasOwnVars || hasExposedPartials;

  // Build imports
  const buildFnImports = partialInfos.map(
    ({ partial, buildFnName: bfn }) =>
      `import { ${bfn} } from "${generatedRelativeModule(
        generatedFile,
        generatedFilePath(partial),
        options,
      )}";`,
  );
  const typeImports = exposedPartials.map(
    ({ partial, pascalName: pn }) =>
      `import type { ${pn}Variables } from "${generatedRelativeModule(
        generatedFile,
        generatedFilePath(partial),
        options,
      )}";`,
  );

  // Interface fields from exposed partials
  const partialFields = exposedPartials.map(
    ({ varsKey, pascalName: pn }) => `  ${varsKey}: ${pn}Variables;`,
  );

  // Partials map entries for the renderTemplate call
  const partialsEntries = partialInfos.map(
    ({ buildFnName: bfn, hasEffectiveVars, varsKey, partialsKey }) =>
      hasEffectiveVars
        ? `${JSON.stringify(partialsKey)}: ${bfn}(vars.${varsKey})`
        : `${JSON.stringify(partialsKey)}: ${bfn}()`,
  );
  const partialsArg =
    partialsEntries.length > 0 ? `{ ${partialsEntries.join(", ")} }` : null;

  const lines: string[] = [
    referenceDirective(generatedFile, typesFile),
    `// AUTO-GENERATED by tpl — do not edit`,
    `// Source: ${relSource}`,
    ...syntaxCommentLines(),
    ``,
    `import { renderTemplate } from "the-prompting-library/runtime";`,
    ...templateSourceRuntimeImports(sourceMode),
  ];

  if (sourceMode === "import") {
    lines.push(
      templateDeclarationLine("TEMPLATE", template, generatedFile, options),
    );
  }
  if (buildFnImports.length > 0) lines.push(...buildFnImports);
  if (typeImports.length > 0) lines.push(...typeImports);
  lines.push(``);
  if (sourceMode !== "import") {
    lines.push(
      templateDeclarationLine("TEMPLATE", template, generatedFile, options),
    );
    lines.push(``);
  }

  // JSDoc
  lines.push(`/**`);
  if (description) lines.push(` * ${description}`);
  lines.push(` * @source ${relSource}`);
  lines.push(` */`);

  // Interface — always exported (even when empty) so parent templates can import the type
  for (const v of variables) {
    const alias = variableTypeAliasName(pascalName, v);
    if (alias) lines.push(`export type ${alias} = ${v.type};`);
  }
  if (variables.some((v) => variableTypeAliasName(pascalName, v))) {
    lines.push(``);
  }
  if (!needsVars) {
    lines.push(`export interface ${interfaceName} {}`);
  } else {
    lines.push(`export interface ${interfaceName} {`);
    for (const v of variables) {
      const optional = v.optional ? "?" : "";
      lines.push(`  ${v.name}${optional}: ${variableTypeName(pascalName, v)};`);
    }
    for (const field of partialFields) {
      lines.push(field);
    }
    lines.push(`}`);
  }
  lines.push(``);

  // Build function
  // When there are exposed partials, the vars object includes nested partial sub-objects
  // (e.g. vars.footer = { email, phone }). Passing the full vars to renderTemplate would
  // cause flattenVars to hoist those keys into the parent's substitution context, making
  // footer.email silently available as {{email}} in the parent template. Instead, pass
  // only the template's own variables explicitly.
  const ownVarsArg =
    exposedPartials.length > 0
      ? variables.length > 0
        ? `{ ${variables.map((v) => `${v.name}: vars.${v.name}`).join(", ")} }`
        : `{}`
      : `vars`;

  const callArgs = needsVars
    ? partialsArg
      ? `${ownVarsArg}, ${partialsArg}`
      : ownVarsArg
    : partialsArg
      ? `{}, ${partialsArg}`
      : `{}`;

  if (needsVars) {
    lines.push(
      `export function ${buildFnName}(vars: ${interfaceName}): string {`,
    );
  } else {
    lines.push(`export function ${buildFnName}(): string {`);
  }
  lines.push(`  return renderTemplate(TEMPLATE, ${callArgs});`);
  lines.push(`}`);
  if (legacyBuildFnName) {
    lines.push(``);
    lines.push(
      `export const ${legacyBuildFnName}: typeof ${buildFnName} = ${buildFnName};`,
    );
  }
  lines.push(``);

  return lines.join("\n");
}

/**
 * Generate a collision file containing both templates.
 * The duplicate function declarations cause TypeScript errors in the IDE.
 */
function generateCollisionFile(
  templates: ParsedTemplate[],
  allTemplates: Map<string, ParsedTemplate>,
  rootDir: string,
  generatedFile: string,
  typesFile: string,
  options: GenerateOptions,
): string {
  const firstTemplate = templates[0];
  if (!firstTemplate) {
    throw new Error("Cannot generate a collision file without templates.");
  }
  const functionName = firstTemplate.functionName;
  const pascalName = toPascalCase(functionName);
  const buildFnName = buildFunctionName(functionName);
  const sourceMode = templateSourceMode(options);

  const lines: string[] = [
    referenceDirective(generatedFile, typesFile),
    `// AUTO-GENERATED by tpl — do not edit`,
    `// ⚠️  NAME COLLISION: multiple templates map to '${functionName}'`,
    `// Rename one of the following files to resolve this:`,
    ...templates.map(
      (t) => `//   ${toImportPath(relative(rootDir, t.filePath))}`,
    ),
    `// Until then, the duplicate declarations below will cause TypeScript errors.`,
    ...syntaxCommentLines(),
    ``,
    `import { renderTemplate } from "the-prompting-library/runtime";`,
    ...templateSourceRuntimeImports(sourceMode),
  ];

  templates.forEach((t, i) => {
    if (sourceMode === "import") {
      lines.push(
        templateDeclarationLine(`TEMPLATE_${i + 1}`, t, generatedFile, options),
      );
    }
  });

  lines.push(``);
  templates.forEach((t, i) => {
    if (sourceMode !== "import") {
      lines.push(
        templateDeclarationLine(`TEMPLATE_${i + 1}`, t, generatedFile, options),
      );
    }
  });

  templates.forEach((t, i) => {
    const relSource = toImportPath(relative(rootDir, t.filePath));
    let partialInfos: PartialInfo[];
    try {
      partialInfos = collectDirectPartialInfos(t, allTemplates);
    } catch {
      partialInfos = [];
    }
    const hasVars =
      t.variables.length > 0 || partialInfos.some((p) => p.hasEffectiveVars);

    lines.push(``);
    lines.push(`// ↓ from ${relSource}`);
    lines.push(`/**`);
    if (t.description) lines.push(` * ${t.description}`);
    lines.push(` * @source ${relSource}`);
    lines.push(` */`);

    if (hasVars) {
      for (const v of t.variables) {
        const alias = variableTypeAliasName(pascalName, v);
        if (alias) lines.push(`export type ${alias} = ${v.type};`);
      }
      if (t.variables.some((v) => variableTypeAliasName(pascalName, v))) {
        lines.push(``);
      }
      lines.push(`export interface ${pascalName}Variables {`);
      for (const v of t.variables) {
        lines.push(
          `  ${v.name}${v.optional ? "?" : ""}: ${variableTypeName(pascalName, v)};`,
        );
      }
      lines.push(`}`);
      lines.push(``);
      lines.push(
        `export function ${buildFnName}(vars: ${pascalName}Variables): string {`,
      );
      lines.push(`  return renderTemplate(TEMPLATE_${i + 1}, vars);`);
    } else {
      lines.push(`export function ${buildFnName}(): string {`);
      lines.push(`  return renderTemplate(TEMPLATE_${i + 1}, {});`);
    }
    lines.push(`}`);
  });

  lines.push(``);
  return lines.join("\n");
}

/** Shared syntax comment block for all generated files. */
function syntaxCommentLines(): string[] {
  return [
    `// Syntax:`,
    `//   {{var}}               required variable (string by default)`,
    `//   {{var:type}}          typed: string | number | boolean | string[]`,
    `//   {{var|default}}       optional — uses default when omitted`,
    `//   {{#if var}}...{{/if}} conditional block — condition-only vars are optional booleans`,
    `//   {{#switch v}}...{{/switch}} first matching {{#case "x"}} / {{#case 'x'}} / {{#case x}} ... {{/case}}, else {{#default}}...{{/default}}`,
    `//   {{> ./path}}          relative partial — vars-less partials auto-render; vars partials become nested interface fields`,
    `// Docs: https://github.com/timurkr/tpl`,
  ];
}

function buildNestedPrompts(
  entries: Array<{ promptPath: string[]; buildFnName: string }>,
): string {
  interface PromptNode {
    buildFnName?: string;
    children: Record<string, PromptNode>;
  }

  const root: PromptNode = { children: {} };

  for (const { promptPath, buildFnName } of entries) {
    let cursor = root;
    for (const segment of promptPath.slice(0, -1)) {
      cursor.children[segment] ??= { children: {} };
      cursor = cursor.children[segment];
    }
    const leaf = promptPath.at(-1);
    if (leaf) {
      cursor.children[leaf] ??= { children: {} };
      cursor.children[leaf].buildFnName = buildFnName;
    }
  }

  function renderNode(node: PromptNode, indent = 0): string {
    const childKeys = Object.keys(node.children);
    if (node.buildFnName && childKeys.length === 0) return node.buildFnName;
    if (node.buildFnName) {
      return `Object.assign(${node.buildFnName}, ${renderObject(
        node.children,
        indent,
      )})`;
    }
    return renderObject(node.children, indent);
  }

  function renderObject(
    children: Record<string, PromptNode>,
    indent = 0,
  ): string {
    const pad = " ".repeat(indent);
    const childPad = " ".repeat(indent + 2);
    const lines = ["{"];
    for (const [key, child] of Object.entries(children)) {
      lines.push(`${childPad}${key}: ${renderNode(child, indent + 2)},`);
    }
    lines.push(`${pad}}`);
    return lines.join("\n");
  }

  return renderNode(root);
}

/** Generate the barrel file that re-exports all prompts and defines the prompts object. */
function generateIndexFile(
  groups: Array<{ name: string; template: ParsedTemplate }>,
  outputFile: string,
  typesFile: string,
  options: GenerateOptions,
): string {
  const ext = importSuffixForGeneratedModules(options);
  const lines: string[] = [
    referenceDirective(outputFile, typesFile),
    `// AUTO-GENERATED by tpl — do not edit`,
    `// Generated manifest for ${groups.length} prompts`,
    ``,
  ];

  for (const { template } of groups) {
    lines.push(
      `export * from "${generatedRelativeModule(
        outputFile,
        generatedFilePath(template),
        options,
      )}";`,
    );
    lines.push(
      `export type { ${exportedTypeNames(template).join(", ")} } from "${generatedRelativeModule(
        outputFile,
        generatedFilePath(template),
        options,
      )}";`,
    );
  }

  lines.push(``);

  for (const { name, template } of groups) {
    const buildFnName = buildFunctionName(name);
    lines.push(
      `import { ${buildFnName} } from "${generatedRelativeModule(
        outputFile,
        generatedFilePath(template),
        options,
      )}";`,
    );
  }

  const promptEntries = groups.map(({ name, template }) => ({
    dotName: template.promptPath.join("."),
    buildFnName: buildFunctionName(name),
    promptPath: template.promptPath,
  }));

  lines.push(``);
  lines.push(`/**`);
  lines.push(` * All prompt builder functions, nested by template path.`);
  lines.push(` *`);
  lines.push(` * @example`);
  lines.push(` * import { prompts } from "./lib/tpl.gen.${ext}";`);
  lines.push(` * const text = prompts.blog.post.summarize({ topic: "AI" });`);
  lines.push(` */`);
  lines.push(
    `export const prompts = ${buildNestedPrompts(promptEntries)} as const;`,
  );
  lines.push(``);
  lines.push(`export const promptMap = {`);
  for (const entry of promptEntries) {
    lines.push(`  ${JSON.stringify(entry.dotName)}: ${entry.buildFnName},`);
  }
  lines.push(`} as const;`);
  lines.push(``);
  lines.push(`type PromptName = keyof typeof promptMap;`);
  lines.push(
    `type PromptArgs<Name extends PromptName> = Parameters<(typeof promptMap)[Name]>;`,
  );
  lines.push(``);

  lines.push(`/**`);
  lines.push(` * Render any prompt by name at runtime.`);
  lines.push(
    ` * Useful when the template name comes from config or user input.`,
  );
  lines.push(` *`);
  lines.push(` * @example`);
  lines.push(` * renderPrompt("blog.post.summarize", { topic: "AI" });`);
  lines.push(` */`);
  lines.push(`export function renderPrompt<Name extends PromptName>(`);
  lines.push(`  name: Name,`);
  lines.push(`  ...args: PromptArgs<Name>`);
  lines.push(`): string {`);
  lines.push(
    `  return (promptMap[name] as (...args: PromptArgs<Name>) => string)(...args);`,
  );
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

/** The ambient type declaration that allows TypeScript to understand *.tpl.* imports. */
function generateTplDts(): string {
  return [
    `// AUTO-GENERATED by tpl — do not edit`,
    `// Ambient module declarations for generated prompt files.`,
    ``,
    `declare module "*.tpl.md" { const content: string; export default content; }`,
    `declare module "*.tpl.mdx" { const content: string; export default content; }`,
    `declare module "*.tpl.txt" { const content: string; export default content; }`,
    `declare module "*.tpl.html" { const content: string; export default content; }`,
    ``,
    `declare module "node:fs" { export function readFileSync(path: string, encoding: "utf8"): string; }`,
    `declare module "node:path" { export function dirname(path: string): string; export function join(...paths: string[]): string; }`,
    `declare module "node:url" { export function fileURLToPath(url: string): string; }`,
    ``,
    `interface ImportMeta { url: string; }`,
    ``,
  ].join("\n");
}

/**
 * Returns a Map of absolute file path → file content for each colocated prompt
 * file plus the generated manifest and ambient declaration file.
 *
 * Partial handling (A+ strategy):
 *   - Partials with no effective variables are auto-rendered; they don't appear
 *     in the parent interface and the caller never needs to supply them.
 *   - Partials with effective variables are exposed as nested typed fields; the
 *     parent's build function delegates to the partial's build function.
 *
 * Name collisions: both templates are merged into one file with duplicate
 * declarations, which TypeScript flags as errors.
 *
 * Circular includes: the affected file gets a @ts-expect-error marker that
 * TypeScript surfaces as an error, without preventing other prompts from generating.
 */
export function generateFiles(
  templates: ParsedTemplate[],
  allTemplates: Map<string, ParsedTemplate>,
  options: GenerateOptions,
): Map<string, string> {
  const { rootDir, outputFile } = options;
  const typesFile = generatedDtsPath(outputFile, options.typesOutputFile);

  const grouped = new Map<string, ParsedTemplate[]>();
  for (const t of templates) {
    const existing = grouped.get(t.functionName) ?? [];
    existing.push(t);
    grouped.set(t.functionName, existing);
  }

  const out = new Map<string, string>();
  const manifestGroups: Array<{ name: string; template: ParsedTemplate }> = [];

  for (const [name, group] of grouped) {
    const firstTemplate = group[0]!;
    manifestGroups.push({ name, template: firstTemplate });
    if (group.length === 1) {
      out.set(
        generatedFilePath(firstTemplate),
        generateSinglePromptFile(
          firstTemplate,
          allTemplates,
          rootDir,
          generatedFilePath(firstTemplate),
          typesFile,
          options,
        ),
      );
    } else {
      for (const template of group) {
        out.set(
          generatedFilePath(template),
          generateCollisionFile(
            group,
            allTemplates,
            rootDir,
            generatedFilePath(template),
            typesFile,
            options,
          ),
        );
      }
    }
  }

  out.set(
    outputFile,
    generateIndexFile(manifestGroups, outputFile, typesFile, options),
  );
  out.set(typesFile, generateTplDts());

  return out;
}
