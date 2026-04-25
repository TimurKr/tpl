# TPL Example App

This is a working example showing how to use TPL in a project.

## Quick Start

```bash
# From the repo root:
bun install

# Develop — watcher regenerates on every .tpl.md save (preferred):
bun run --cwd apps/example dev

# One-shot (same as CI / build would run):
bun run --cwd apps/example generate
```

## What's here

- `src/shared/base-persona.tpl.md` — shared persona snippet used via includes
- `src/features/auth/welcome-email.tpl.md` — welcome email prompt with 3 variables
- `src/features/auth/password-reset.tpl.md` — password reset prompt
- `src/features/search/search-query.tpl.md` — semantic search rewriter
- `src/features/support/ticket-classifier.tpl.md` — support ticket classifier

After `tpl watch` or `tpl generate`, each template gets a sibling `*.tpl.gen.ts` file. The generated manifest lives at `lib/tpl.gen.ts` (see `"tpl".output` in `package.json`).
