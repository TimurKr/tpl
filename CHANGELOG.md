# Changelog

All notable changes to this project are documented here.

## 0.11.0 - 2026-05-05

### Added

- Switch-only discriminants now infer string literal unions from their `{{#case ...}}` values in generated TypeScript. For example, `{{#switch tone}}` with `{{#case "friendly"}}` and `{{#case "formal"}}` now generates `tone: "friendly" | "formal"` instead of `tone: string`.
- Switch-only discriminants become optional when every switch for that variable has a `{{#default}}` branch, preserving type safety while allowing callers to rely on the default path.
- Generated prompt modules now export inferred switch literal unions as named type aliases, and the generated manifest explicitly re-exports prompt variable interfaces and inferred aliases so app code can import them from `lib/tpl.gen.ts`.
- The example app now includes a `shared/response-style.tpl.md` switch template demonstrating inferred literal-union types with a default branch.

## 0.10.0 - 2026-05-05

### Changed

- Generated prompt builders now read template text from the colocated `.tpl.*` file by default instead of importing it with `with { type: "text" }`. This keeps prompt text single-sourced while avoiding Next/Turbopack and other framework loader gaps where source template imports can resolve to `undefined` at runtime.

### Migration Notes

- This default generated loader is server-only because it uses `node:fs` and `node:url`. Browser, edge, or bundle-only environments should set `"templateSource": "import"` to preserve the previous import-based behavior, or `"templateSource": "inline"` only when duplicating prompt text in generated files is acceptable.

### Added

- **`{{#switch discriminant}}` … `{{/switch}}`** — multi-way template branching with `{{#case "literal"}}` … `{{/case}}` (also single-quoted or bare word literals), optional `{{#default}}` … `{{/default}}`. The first case whose literal equals the discriminant wins (`String(value)` for defined non-null values; **`undefined` / `null` match only `{{#case ""}}`**). Otherwise the default branch is used if present. `renderTemplate` alternates `#if` and `#switch` passes until stable so switches inside falsy conditionals are not expanded, while `#if` inside a chosen case still runs after the switch resolves.
- Parser records the switch discriminant like any other name: it becomes a **required `string`** only when that name is not already present from `{{var}}` / `{{var:type}}` or from a **condition-only** `{{#if name}}` (which infers optional `boolean` first—the discriminant clause does not override that).
- Added `templateSource` config with `"filesystem"` (default), `"import"`, and `"inline"` modes. `"import"` preserves the previous source-import behavior, while `"inline"` remains available for environments that cannot read sibling template files at runtime.
- Added `templateImportAttributeType` config for import mode, supporting `"text"` and `"raw"` import attributes.

## 0.8.0 - 2026-05-04

### Added

- **`@tpl/core/runtime` subpath** — dependency-free build of `renderTemplate` / `flattenVars` (and `patterns`) only. Published `the-prompting-library/runtime` now bundles this entry instead of the full `@tpl/core` graph, so **fast-glob and other generator dependencies are not pulled into app or browser bundles** when you import the runtime.
- **`importSpecifierExtension`** in `package.json` → `tpl` (`"js"` default, `"ts"` optional). Controls the extension on relative imports between generated `.tpl.gen.ts` files and the manifest. Use `"ts"` when your bundler (e.g. some Turbopack setups) does not resolve emitted `./foo.js` imports to `./foo.ts` sources.
- **`postprocess`** in `package.json` → `tpl`: path to an ES module (e.g. `.mjs`) that transforms each generated file before write. Export `default` or `transformGenerated` as `(filePath, content, { rootDir }) => string`. **`tpl check` runs the same postprocess as `tpl generate`**, so you can drop custom check wrappers that reimplemented normalization.

### Changed

- `the-prompting-library/runtime` is built with `platform: "neutral"` and only inlines `@tpl/core/runtime`, improving compatibility with Next.js and other app bundles that previously tripped on dynamic `require` paths from the old fat runtime bundle.

## 0.7.2 - 2026-05-02

### Fixed

- `renderTemplate` now correctly pairs nested `{{#if}}…{{/if}}` blocks using a depth counter. Previously a lazy regex paired the outer `{{#if}}` with the first inner `{{/if}}`, leaving an orphan closing tag in the output and removing the wrong content. Templates that nest conditionals (e.g. `{{#if a}}…{{#if b}}…{{/if}}…{{/if}}`) now render as expected for every combination of truthy/falsy variables.

## 0.7.1 - 2026-04-26

### Fixed

- Relative includes can now target folder-index templates. For example, `{{> ./welcome-email}}` resolves to `welcome-email/index.tpl.*` when no sibling `welcome-email.tpl.*` file exists.
- Direct sibling templates keep precedence over folder-index fallbacks, so `{{> ./welcome-email}}` still resolves to `welcome-email.tpl.*` when both forms exist.
- Nested `prompts` entries can now be callable and still expose child prompts, so `prompts.auth.welcomeEmail()` and `prompts.auth.welcomeEmail.tone()` can coexist when an `index.tpl.*` template has colocated child templates.

### Changed

- README now notes that folder-path includes can resolve to `index.tpl.md` templates.
- The example app now demonstrates folder-index composition with `auth/welcome-email/index.tpl.md` and a parent template that includes it by folder path.

## 0.7.0 - 2026-04-26

### Added

- Templates named `index.tpl.*` now default to their containing folder name in generated prompt paths and builder names. For example, `src/features/auth/index.tpl.md` generates `prompts.features.auth`, `promptMap["features.auth"]`, and `buildFeaturesAuthPrompt`.

### Changed

- `index.tpl.*` naming is applied after `namespaceAliases`, so aliases can still remove or rename framework folders before the folder-derived prompt name is generated.
- If `folder.tpl.*` and `folder/index.tpl.*` resolve to the same prompt name, generation now follows the existing name-collision diagnostic path instead of silently choosing one.

## 0.6.0 - 2026-04-26

### Breaking Changes

- Includes now use relative paths only, such as `{{> ./partial}}` or `{{> ../shared/base-persona}}`. Bare/global include names like `{{> basePersona}}` no longer resolve.
- Generated `prompts` are now nested by template path instead of flat short names. For example, `prompts.welcomeEmail()` becomes `prompts.features.auth.welcomeEmail()` or an alias-shortened path like `prompts.auth.welcomeEmail()`.
- Dynamic rendering now uses dot-path prompt names through `promptMap`, such as `renderPrompt("auth.welcomeEmail", args)`, instead of short names like `renderPrompt("welcomeEmail", args)`.
- Generated builder function names now include path-derived namespace segments, for example `buildFeaturesAuthWelcomeEmailPrompt`, so direct imports from generated files may need updating.
- Runtime partial maps now use the include path or include alias as the key instead of the derived partial function name.

### Added

- Added `namespaceAliases` config for rewriting or removing noisy path segments before generating prompt names.
- Added include aliases with `as`, for example `{{> ../../shared/base-persona as persona}}`, to control the local nested variable key exposed by a parent template.
- Added `promptMap` alongside the nested `prompts` object for dynamic prompt lookup by dot-path name.
- `ParsedTemplate` now includes `promptPath`, the generated nested prompt object path for each template.
- Generation now reports structured issues for name collisions and include errors.
- `tpl generate` now exits non-zero when generated prompts contain diagnostic errors; `tpl watch` prints those issues without stopping the watcher.

### Changed

- Include resolution now matches files relative to the template containing the include.
- Runtime partial resolution now keys partials by include path or alias instead of derived function name.
- Same-stem templates in different folders can now generate distinct path-based names instead of colliding by default.
- Generated prompt modules now import other generated modules with `.js` specifiers for Node16/NodeNext-compatible ESM output.
- Generated files now emit include and name-collision diagnostics as TypeScript-visible output while continuing to write unaffected prompts.
- The public `generate()` result now includes an `issues` array with name-collision and include-error diagnostics.
- Generated parent prompt functions now pass only their own variables into `renderTemplate`, so variables supplied for partials no longer leak into the parent's substitution context.
- Docs and examples were updated to prefer the new generated file layout, relative includes, include aliases, nested prompt access, and `namespaceAliases`.
- README now explicitly labels TPL as alpha and notes that minor versions may include breaking changes while the API settles.
