# TPL — The Prompting Library

_Updated: 2026-04-24_
_Status: SHIPPED_

---

## Problem Statement

Prompts exist as inline string literals scattered across AI app codebases:

- Invisible until you read the code.
- Editing them requires touching application logic.
- No type safety on variable injection — runtime surprises instead of compile errors.

---

## The Idea

**"Prisma for your prompts."**

- Drop a `.tpl.md` file next to the code that uses it.
- Use `{{variableName}}` syntax for required variables, with optional types and defaults.
- Run `tpl watch` in your dev script. Every save regenerates a fully-typed TypeScript module.
- No config needed. Just Markdown + a naming convention.

---

## File Format

```markdown
---
description: Welcome email for new users
---

{{> basePersona}}

Write a welcome email to {{userName}} who just signed up for {{productName}}.
Their plan is {{planType|free}}. Keep it under 150 words.

{{#if note}}
**Note:** {{note}}
{{/if}}
```

Supported variable syntax:
- `{{name}}` — required string
- `{{name:number}}` — typed (string | number | boolean | string[])
- `{{name|default}}` — optional with default
- `{{name:number|0}}` — typed optional with default
- `{{#if name}}...{{/if}}` — conditional block (auto-marks `name` as optional)
- `{{> partialName}}` — include a partial by name (camelCase or kebab-case)

---

## Architecture

```
src/
  features/auth/
    welcome-email.tpl.md    ← co-located with the feature
  shared/
    base-persona.tpl.md     ← shared partial

lib/prompts/                ← generated output
  index.ts                  ← prompts const + renderPrompt()
  welcomeEmail.ts           ← one file per template
  basePersona.ts
  tpl.d.ts                  ← *.tpl.md ambient module declaration
```

---

## Generated File Structure

Each template produces its own `.ts` file. The source `.tpl.md` is **imported directly** — content is never duplicated into the TypeScript output:

```typescript
// lib/prompts/welcomeEmail.ts
/// <reference path="./tpl.d.ts" />

import { renderTemplate } from "the-prompting-library/runtime";
import TEMPLATE from "../../src/features/auth/welcome-email.tpl.md" with { type: "text" };
import _basePersona from "../../src/shared/base-persona.tpl.md" with { type: "text" };
import type { BasePersonaVariables } from "./basePersona";

/** Welcome email for new users */
export interface WelcomeEmailVariables {
  userName: string;
  productName: string;
  planType?: string;        // optional — has default "free"
  note?: string;            // optional — appears only in {{#if}}
  basePersona: BasePersonaVariables;  // nested partial vars
}

export function buildWelcomeEmailPrompt(vars: WelcomeEmailVariables): string {
  return renderTemplate(TEMPLATE, vars, { basePersona: _basePersona });
}
```

Every template always exports its interface (even if empty), so parent templates can always import the type.

---

## Consumer API

```typescript
import { prompts, renderPrompt } from "./lib/prompts/index.ts";

// Recommended: short key via prompts object
prompts.welcomeEmail({ userName: "Alice", productName: "Acme", basePersona: {} });

// Tree-shaking: import a single build function
import { buildWelcomeEmailPrompt } from "./lib/prompts/welcomeEmail.ts";

// Dynamic dispatch: template name from config or user input
renderPrompt("welcomeEmail", { userName: "Alice", productName: "Acme", basePersona: {} });
```

---

## CLI

```bash
tpl watch             # dev — regenerates on every .tpl.md change (~50ms debounce)
tpl generate          # CI/CD — one-shot generation
```

```json
{
  "scripts": {
    "dev":   "tpl watch & next dev",
    "build": "tpl generate && next build"
  }
}
```

---

## Package Layout (monorepo)

```
packages/
  core/           (@tpl/core) — parser, resolver, codegen, runtime
  cli/            (the-prompting-library) — CLI binary + runtime re-export
apps/
  example/        — working example app
  docs/           — Mintlify docs
```

The CLI package has two exports:
- `bin: tpl` — the code-generation CLI
- `./runtime` — `renderTemplate` and `flattenVars` used by generated files at runtime

---

## Error Handling

| Situation | Behaviour |
|-----------|-----------|
| Missing include | Throws at generation time with clear message |
| Circular include | Generates the file with `@ts-expect-error` → TypeScript error in IDE |
| Name collision | Generates a single file with both functions → TypeScript duplicate-declaration error |

---

## Tech Stack

- **chokidar** — file watching
- **fast-glob** — discover all `.tpl.md` files
- **gray-matter** — parse optional YAML frontmatter
- **commander** — CLI argument parsing
