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
import { prompts } from "./lib/prompts/index.ts";

const text = prompts.welcomeEmail({
  userName: "Alice",
  productName: "Acme AI",
  planType: "Pro",
});
// Wrong variable name → compile error. Missing field → compile error.
```

Run `tpl watch` in your dev script. Every save regenerates the typed function in milliseconds. No config, no framework.

---

## Quick start

**1. Let your AI agent do it:**

Paste this into Cursor, Claude, or Copilot. It finds every inline prompt in your codebase, extracts them into `.tpl.md` files co-located with their feature, and refactors all call sites.

<details>
<summary><strong>📋 Copy the AI adoption prompt</strong></summary>

```text
You are helping adopt TPL (The Prompting Library) in this codebase.

TPL turns scattered inline prompt strings into typed TypeScript functions. Drop
.tpl.md files next to the code that uses them, run `tpl generate`, and get
fully-typed functions — wrong variables become compile errors, not runtime surprises.

───────────────────────────────────────────
STEP 1 — INSTALL
───────────────────────────────────────────

  npm install -D the-prompting-library

Update package.json scripts. Check if a "dev" script already exists:
- If yes, prepend `tpl watch &` to it (e.g. `"dev": "tpl watch & next dev"`)
- If no, create one: `"dev": "tpl watch"`

Also add tpl generate to the build script:

  "build": "tpl generate && <existing-build-command>"

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
STEP 5 — GENERATE AND REFACTOR
───────────────────────────────────────────

  npx tpl generate

Then replace each inline prompt with the generated typed function:

Before:
  const prompt = `Write a welcome email to ${user.name}...`;

After:
  import { prompts } from "./lib/prompts/index.ts";
  const prompt = prompts.welcomeEmail({ userName: user.name, planType: plan });

───────────────────────────────────────────
STEP 6 — VERIFY
───────────────────────────────────────────

  npx tpl generate   → all prompts listed, no errors
  tsc --noEmit       → no type errors at call sites
```

</details>

**2. Or do it manually:**

Install:

```bash
npm install -D the-prompting-library
# or: bun add -D the-prompting-library
# or: pnpm add -D the-prompting-library
```

Add to your scripts:

```json
{
  "scripts": {
    "dev": "tpl watch & next dev",
    "build": "tpl generate && next build"
  }
}
```

Create a `.tpl.md` file next to the code that uses it:

```markdown
## <!-- src/features/auth/welcome-email.tpl.md -->

## description: Welcome email for new users

Write a warm welcome email to {{userName}} who just signed up for {{productName}}.
Their plan is {{planType}}. Keep it under 150 words.
```

Use the generated function:

```typescript
import { prompts } from "./lib/prompts/index.ts";

const text = prompts.welcomeEmail({
  userName: "Alice",
  productName: "Acme AI",
  planType: "Pro",
});
```

---

## Development workflow

```bash
tpl watch
```

Keep this running alongside your dev server. It generates on startup and re-generates within ~50 ms of any `.tpl.md` save. The generated files in `lib/prompts/` are always in sync.

```
✓ Generated 5 prompt(s) → lib/prompts/
~ Detected change: src/features/auth/welcome-email.tpl.md
✓ Generated 5 prompt(s) → lib/prompts/
```

## CI / production

```bash
tpl generate
```

One-shot generation for build pipelines. Run it before your TypeScript compiler so the generated types are fresh.

```json
{
  "scripts": {
    "build": "tpl generate && tsc && ..."
  }
}
```

## Gitignore

`lib/prompts/` is generated from your `.tpl.md` source files, so you can gitignore it and regenerate at build time:

```gitignore
lib/prompts/
```

Or commit it — both are valid. Committing the generated files means diffs are visible in PRs and CI doesn't need to run `tpl generate` before type-checking.

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

Names must be unique across the entire project. Collisions produce TypeScript errors in the generated file pointing at both conflicting sources.

---

## Configuration

Zero config needed. Override via the `"tpl"` key in `package.json`:

```json
{
  "tpl": {
    "output": "lib/prompts",
    "pattern": "**/*.tpl.md",
    "ignore": ["src/vendor/**"]
  }
}
```

| Key       | Default         | Description                                 |
| --------- | --------------- | ------------------------------------------- |
| `output`  | `"lib/prompts"` | Output directory (relative to project root) |
| `pattern` | `"**/*.tpl.md"` | Glob pattern for finding prompt files       |
| `ignore`  | `[]`            | Additional patterns to ignore               |

Always ignored: `node_modules`, `dist`, `.git`.

---

## CLI reference

```bash
tpl watch             # dev — regenerates on every .tpl.md change (~50 ms debounce)
tpl watch --cwd ./packages/backend

tpl generate          # CI/CD — one-shot generation
tpl generate --output src/generated/prompts   # override output dir
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
