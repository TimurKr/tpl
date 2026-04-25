<p align="center">
  <img src="logo.png" alt="TPL logo" width="240" />
</p>

# TPL — The Prompting Library

Prompts are too important to live as inline strings buried in your code.

TPL gives them their own files — `.tpl.md` — and generates fully-typed TypeScript functions from them automatically.

```markdown
<!-- base-persona.tpl.md -->
You are a helpful, concise assistant. Respond professionally.

<!-- welcome-email.tpl.md -->
{{> basePersona}}

Write a warm welcome email to {{userName}} who just signed up for {{productName}}.
Their plan is {{planType}}. Keep it under 150 words.
```

```typescript
import { prompts } from "./lib/tpl.gen.js";

const text = prompts.welcomeEmail({
  userName: "Alice",
  productName: "Acme AI",
  planType: "Pro",
});
// Wrong variable name → compile error. Missing field → compile error.
```

Run `tpl watch` in your dev script. Every save regenerates the typed function in milliseconds. No config, no framework. Generated modules use `.js` in relative imports for **Node16 / NodeNext** ESM compatibility.

---

## Quick start

**Preferred setup:** run **`tpl watch` during development** (Markdown and generated TypeScript never drift) and **`tpl generate` in CI and production builds** (clean checkouts typecheck without the watcher). Start with the watcher, add a template, confirm the sibling generated file and manifest appear, then import from your app.

### 1. Install

```bash
npm install -D the-prompting-library
# or: bun add -D the-prompting-library
# or: pnpm add -D the-prompting-library
```

### 2. Wire `dev` and `build`

```json
{
  "scripts": {
    "dev": "tpl watch & next dev",
    "build": "tpl generate && next build"
  }
}
```

- **`dev`:** prefix with `tpl watch` (or run `tpl watch` alone if you have no other dev server). The watcher runs an initial generate, then rebuilds on every `.tpl.md` save (~50 ms).
- **`build`:** prefix with `tpl generate` so CI and `npm run build` always compile against fresh generated files. Use `tpl check` in CI if generated files are committed and you want to fail when they drift.

### 3. Start the listener

```bash
npm run dev
# or: npx tpl watch
```

You should see a line like: `Generated N prompt(s) → lib/tpl.gen.ts`.

### 4. Write your first template

Create a `.tpl.md` next to your code, for example `src/features/auth/welcome-email.tpl.md`:

```markdown
---
description: Welcome email for new users
---

Write a warm welcome email to {{userName}} who just signed up for {{productName}}.
Their plan is {{planType}}. Keep it under 150 words.
```

Save the file. The terminal should show a short regenerate log within ~50 ms. Confirm `src/features/auth/welcome-email.tpl.gen.ts` and the default manifest `lib/tpl.gen.ts` appeared. That means the dev loop is working.

### 5. Use the generated API

With **strict ESM** (`"module": "NodeNext"` / `"moduleResolution": "Node16"` or `NodeNext`), use a **`.js` extension** in relative imports; TypeScript resolves them to the `.ts` sources on disk.

```typescript
import { prompts } from "./lib/tpl.gen.js";
```

Or import a single builder: `import { buildWelcomeEmailPrompt } from "./src/features/auth/welcome-email.tpl.gen.js"`.

### 6. CI / production

You already added `tpl generate` to `build`. The same one-shot command is what you run in CI before `tsc` or your bundler, so you never need the watcher on a server. If generated files are committed, `tpl check` verifies they are up to date without writing.

---

**Let an AI extract inline prompts**

Paste this into Cursor, Claude, or Copilot. It finds inline prompts, adds `.tpl.md` files, and refactors call sites.

<details>
<summary><strong>📋 Copy the AI adoption prompt</strong></summary>

```text
You are helping adopt TPL (The Prompting Library) in this codebase.

TPL turns inline prompt strings into typed TypeScript functions. Workflow:
- Development: `tpl watch` in the dev script; templates live in .tpl.md files.
- CI/build: `tpl generate` before compile — never rely on the watcher in CI.

───────────────────────────────────────────
STEP 1 — INSTALL & SCRIPTS
───────────────────────────────────────────

  npm install -D the-prompting-library

Add to package.json:
- "dev": prepend `tpl watch &` to the existing dev command (e.g. `tpl watch & next dev`), or use `"dev": "tpl watch"` if there is no other server.
- "build": prepend `tpl generate &&` to the existing build command.

Run `npm run dev` (or `npx tpl watch`) and confirm the CLI prints generated output to `lib/tpl.gen.ts` (or the configured manifest path).

───────────────────────────────────────────
STEP 2 — FIND ALL INLINED PROMPTS
───────────────────────────────────────────

Search for inline prompt strings: template literals or strings assigned to
variables named prompt, systemPrompt, userPrompt, systemMessage, instructions,
or passed directly to AI SDK calls (generateText, streamText, openai, anthropic,
chat.completions.create, etc.), or inside messages arrays ({ role: "system", content: "..." }).

───────────────────────────────────────────
STEP 3 — EXTRACT INTO .tpl.md FILES
───────────────────────────────────────────

For each inlined prompt:

1. Create a .tpl.md file in the SAME DIRECTORY as the source file that uses it.
   Use kebab-case: src/features/email/welcome-email.tpl.md

2. Paste the prompt. Replace interpolated expressions with {{camelCase}} placeholders.

3. Add type hints for non-string values: {{count:number}} {{active:boolean}} {{tags:string[]}}

4. Use defaults for optional values: {{note|}} or {{note|fallback text}}

5. Use conditionals for optional sections:
   {{#if note}}
   **Note:** {{note}}
   {{/if}}

6. Optional frontmatter:
   ---
   description: What this prompt does
   ---

EXAMPLE

Before (inline in route.ts):
  const prompt = `Write a welcome email to ${user.name}. Plan: ${plan}.`;

After (src/features/email/welcome-email.tpl.md):
  ---
  description: Welcome email for new users
  ---
  Write a welcome email to {{userName}}. Plan: {{planType}}.

After saving, the watcher should regenerate. Verify the sibling `*.tpl.gen.ts` file and manifest update.

───────────────────────────────────────────
STEP 4 — SHARED CONTENT
───────────────────────────────────────────

Extract repeated content (base persona, safety guidelines, output format) once:

  src/shared/base-persona.tpl.md:
    You are a helpful, concise assistant.

Reference by name in any other template:
  {{> basePersona}}
  Write a welcome email to {{userName}}...

───────────────────────────────────────────
STEP 5 — REFACTOR CALL SITES
───────────────────────────────────────────

Replace each inline prompt with the generated typed function, importing with .js
for ESM (example):

  import { prompts } from "./lib/tpl.gen.js";
  const prompt = prompts.welcomeEmail({ userName: user.name, planType: plan });

───────────────────────────────────────────
STEP 6 — VERIFY
───────────────────────────────────────────

  npx tpl generate   → all prompts listed, no errors
  tsc --noEmit       → no type errors at call sites
```

</details>

### Manual path (no AI)

If you already added scripts and the watcher in steps 1–3: create a `.tpl.md`, save, confirm the sibling `*.tpl.gen.ts` file and `lib/tpl.gen.ts` update, then import:

```typescript
import { prompts } from "./lib/tpl.gen.js";

const text = prompts.welcomeEmail({
  userName: "Alice",
  productName: "Acme AI",
  planType: "Pro",
});
```

---

## Development workflow

`tpl watch` (via `npm run dev` or on its own) keeps generated prompt files in sync. On startup and on every save:

```
✓ Generated 5 prompt(s) → lib/tpl.gen.ts
~ Detected change: src/features/auth/welcome-email.tpl.md
✓ Generated 5 prompt(s) → lib/tpl.gen.ts
```

`tpl generate` is for CI and production builds only — not the primary day-to-day flow.

---

## Template syntax

### Variables

| Syntax               | TypeScript       | Behaviour                            |
| -------------------- | ---------------- | ------------------------------------ |
| `{{name}}`           | `name: string`   | Required                             |
| `{{name:number}}`    | `name: number`   | Required, typed                      |
| `{{name:boolean}}`   | `name: boolean`  | Required, typed                      |
| `{{name:string[]}}`  | `name: string[]` | Required, joined with `, ` on render |
| `{{name\|default}}`  | `name?: string`  | Optional with default                |
| `{{name:number\|0}}` | `name?: number`  | Optional typed with default          |

Types are declared right in the variable — no separate config that can drift.

### Conditionals

```markdown
{{#if note}}
**Note:** {{note}}
{{/if}}
```

Variables that appear only in `{{#if}}` conditions are automatically optional. The block renders when the value is truthy and is omitted otherwise.

### Includes (partials)

Extract repeated content — base personas, output format instructions, safety guidelines — into their own `.tpl.md` files:

```markdown
<!-- src/shared/base-persona.tpl.md -->

You are a helpful, concise assistant. Respond professionally.
```

Reference by name from any other template:

```markdown
{{> basePersona}}

Write a welcome email to {{userName}}.
```

Include references resolve by name — no path needed.

---

## Naming

File name → exported names:

| File                   | `prompts` key  | Individual import           |
| ---------------------- | -------------- | --------------------------- |
| `welcome-email.tpl.md` | `welcomeEmail` | `buildWelcomeEmailPrompt()` |
| `search-query.tpl.md`  | `searchQuery`  | `buildSearchQueryPrompt()`  |
| `classify.tpl.md`      | `classify`     | `buildClassifyPrompt()`     |

Generated filenames preserve the template stem exactly: `welcome-email.tpl.md` generates `welcome-email.tpl.gen.ts`, and `support_ticket.tpl.md` generates `support_ticket.tpl.gen.ts`.

Names must be unique across the entire project. Collisions produce TypeScript errors in the generated file pointing at both conflicting sources.

---

## Configuration

Zero config needed. Override via the `"tpl"` key in `package.json`:

```json
{
  "tpl": {
    "output": "lib/tpl.gen.ts",
    "pattern": "**/*.tpl.{md,mdx,txt,html}",
    "ignore": ["src/vendor/**"]
  }
}
```

| Key       | Default         | Description                                 |
| --------- | --------------- | ------------------------------------------- |
| `output`  | `"lib/tpl.gen.ts"` | Manifest file path (relative to project root) |
| `pattern` | `"**/*.tpl.{md,mdx,txt,html}"` | Glob pattern for finding prompt files       |
| `ignore`  | `[]`            | Additional patterns to ignore               |

Always ignored: `node_modules`, `dist`, `.git`.

---

## CLI reference

```bash
tpl watch             # dev — regenerates on every .tpl.* change (~50 ms debounce)
tpl watch --cwd ./packages/backend

tpl generate          # CI/CD — one-shot generation
tpl generate --output src/generated/prompts.gen.ts   # override manifest path

tpl check             # CI/CD — fail if committed generated files are stale
```

---

## vs. AgentMark / Prompty

TPL is not an evaluation framework. It's not a runtime. It's a code generator — like Prisma for your prompts.

|                     | TPL                  | AgentMark      | Prompty         |
| ------------------- | -------------------- | -------------- | --------------- |
| Format              | Plain Markdown       | MDX            | YAML + Markdown |
| Config              | Optional frontmatter | Required       | Required        |
| Output              | Typed TS functions   | Runtime object | Runtime object  |
| Type safety         | Compile-time         | ✗              | ✗               |
| Optional variables  | ✓ `{{var\|default}}` | ✗              | ✗               |
| Conditionals        | ✓ `{{#if var}}`      | ✗              | partial         |
| Variable types      | ✓ `{{var:number}}`   | ✗              | ✗               |
| Evaluation built-in | ✗                    | ✓              | ✓               |

---

## License

MIT
