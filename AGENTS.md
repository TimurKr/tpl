# AGENTS.md — Repo Guide

## What this is

**The Prompting Library (tpl)** — a CLI + codegen tool that turns `.tpl.*` template files into typed TypeScript functions. Each template gets a sibling `.tpl.gen.ts` file with a `build<Name>Prompt(vars: <Name>Variables): string` function and full compile-time type safety.

## Repo layout

```
packages/
  core/       Parser, codegen engine, runtime — published as the-prompting-library
  cli/        `tpl` binary (generate / watch commands) — published as the-prompting-library
apps/
  docs/       Mintlify documentation site
  example/    Runnable example showing real usage
```

Both `packages/core` and `packages/cli` are published under the same npm package name (`the-prompting-library`) using different entry points.

## Key source files

| File | Role |
|---|---|
| `packages/core/src/parser.ts` | Parses `.tpl.md` frontmatter + variable/include expressions |
| `packages/core/src/codegen.ts` | Generates `.ts` files from parsed templates |
| `packages/core/src/resolver.ts` | Resolves relative `{{> ./partial}}` includes, detects cycles |
| `packages/core/src/runtime.ts` | `renderTemplate` — used by generated files at runtime |
| `packages/core/src/patterns.ts` | Shared regex patterns (import here, never redefine inline) |
| `packages/cli/src/commands/` | `generate` and `watch` CLI commands |

## Working in the repo

```bash
bun install               # install all workspace deps
bun run build             # build core + cli
bun run test              # run all tests (core + cli)
bun run dev:example       # run the example app
```

Tests use Bun's built-in test runner. Run a single package with:

```bash
bun test packages/core
bun test packages/cli
```

The example app generates sibling `*.tpl.gen.ts` files and a manifest at `apps/example/lib/tpl.gen.ts`. If you change codegen behaviour, re-run the smoke test:

```bash
node packages/cli/dist/index.cjs generate --cwd apps/example
```

## Template syntax (for reference)

```
{{var}}               required string variable
{{var:type}}          typed: string | number | boolean | string[]
{{var|default}}       optional with fallback
{{#if var}}...{{/if}} conditional block (condition-only vars are optional booleans)
{{> ./partial-name}}  include another template by relative path
{{> ./partial-name as localName}} include with local nested variable alias
```

Partials with variables are exposed as nested interface fields. Partials without variables are auto-rendered invisibly.

## Publishing

Releases are fully automated. To publish a new version:

1. Check the full diff from the latest `v*` release tag, not just the current unstaged diff.
2. Invoke the `release-changelog-verifier` subagent before committing. It must verify that `CHANGELOG.md` covers all breaking changes, new functionality, and convention changes, and that nothing is stale or misleading.
3. Bump `"version"` in **`packages/core/package.json`** (the CI reads this file).
4. Keep `packages/cli/package.json` in sync with the same version.
5. Commit and push to `main`.

The **CI/CD** workflow (`.github/workflows/ci-cd.yml`) will:
- Run tests + smoke test
- Check if the version tag already exists on remote
- If not: publish to npm, then push the `vX.Y.Z` tag

If the changelog verifier fails or cannot run, stop the release instead of filling in the changelog manually.

Semantic versioning convention:
- `patch` — bug fixes, doc tweaks, CI changes
- `minor` — new features, new template syntax
- `major` — breaking changes to generated file format or public API
