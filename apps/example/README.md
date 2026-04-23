# TPL Example App

This is a working example showing how to use TPL in a project.

## Quick Start

```bash
# From the repo root:
bun install

# Generate the typed TypeScript file:
bun run --cwd apps/example generate

# Or watch for changes:
bun run --cwd apps/example dev
```

## What's here

- `src/shared/base-persona.tpl.md` — shared persona snippet used via includes
- `src/features/auth/welcome-email.tpl.md` — welcome email prompt with 3 variables
- `src/features/auth/password-reset.tpl.md` — password reset prompt
- `src/features/search/search-query.tpl.md` — semantic search rewriter
- `src/features/support/ticket-classifier.tpl.md` — support ticket classifier

After running `tpl generate`, check `lib/tpl.ts` for the generated output.
