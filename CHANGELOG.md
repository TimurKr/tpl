# Changelog

All notable changes to this project are documented here.

## 0.5.0 - 2026-04-26

### Breaking Changes

- Includes now use relative paths only, such as `{{> ./partial}}` or `{{> ../shared/base-persona}}`. Bare/global include names like `{{> basePersona}}` no longer resolve.
- Generated output now uses sibling `*.tpl.gen.ts` files plus a manifest file, `lib/tpl.gen.ts` by default, instead of the previous generated prompt directory layout. The `tpl.output` config value and `--output` flag now point to the manifest file path.
- Generated `prompts` are now nested by template path instead of flat short names. For example, `prompts.welcomeEmail()` becomes `prompts.features.auth.welcomeEmail()` or an alias-shortened path like `prompts.auth.welcomeEmail()`.
- Dynamic rendering now uses dot-path prompt names through `promptMap`, such as `renderPrompt("auth.welcomeEmail", args)`, instead of short names like `renderPrompt("welcomeEmail", args)`.
- Generated builder function names now include path-derived namespace segments, for example `buildFeaturesAuthWelcomeEmailPrompt`.
- Public core generation options now use `outputFile` and optional `typesOutputFile` instead of `outputDir`.
- Runtime partial maps now use the include path or include alias as the key instead of the derived partial function name.

### Added

- Added `namespaceAliases` config for rewriting or removing noisy path segments before generating prompt names.
- Added `typesOutput` config for choosing the generated ambient declaration file path.
- Added `.tpl.mdx`, `.tpl.txt`, and `.tpl.html` to the default template discovery pattern and generated ambient declarations.
- Added include aliases with `as`, for example `{{> ../../shared/base-persona as persona}}`, to control the local nested variable key exposed by a parent template.
- Added `promptMap` alongside the nested `prompts` object for dynamic prompt lookup by dot-path name.
- Added `tpl check` / `tpl c` for CI drift checks that fail when generated files are missing, changed, or stale.
- Added the public `check()` API and check result types to `@tpl/core`.
- Generation now reports structured issues for name collisions and include errors.
- `tpl generate` now exits non-zero when generated prompts contain diagnostic errors; `tpl watch` prints those issues without stopping the watcher.

### Changed

- Include resolution now matches files relative to the template containing the include.
- Runtime partial resolution now keys partials by include path or alias instead of derived function name.
- Same-stem templates in different folders can now generate distinct path-based names instead of colliding by default.
- Generated prompt modules now import other generated modules with `.js` specifiers for Node16/NodeNext-compatible ESM output.
- Generated files now emit include and name-collision diagnostics as TypeScript-visible output while continuing to write unaffected prompts.
- Condition-only variables from `{{#if var}}` are now inferred as optional booleans.
- Docs and examples were updated to prefer the new generated file layout, relative includes, include aliases, nested prompt access, and `namespaceAliases`.
- README now explicitly labels TPL as alpha and notes that minor versions may include breaking changes while the API settles.
