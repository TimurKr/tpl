# TPL — The Prompting Library

**Drop `.tpl.md` files anywhere. Get fully-typed TypeScript functions.**

No config. No framework. Just Markdown and a naming convention.

---

```bash
npx tpl generate
```

```
✓ Generated 4 prompt(s) → lib/tpl/
```

---

## The problem

Prompts live as inline strings scattered across your codebase:

```typescript
// buried somewhere in route.ts
const prompt = `Write a welcome email to ${user.name} for ${product}. Plan: ${plan}.`;
```

They're invisible until you read the code. Editing them requires touching application logic. And there's zero type safety — pass the wrong variable and you find out at runtime.

## The solution

Drop a `.tpl.md` file next to your code:

```markdown
<!-- src/features/auth/welcome-email.tpl.md -->
---
description: Welcome email for new users
---

Write a warm welcome email to {{userName}} who just signed up for {{productName}}.
Their plan is {{planType}}. Keep it under 150 words.
```

Run `tpl generate` (or keep `tpl watch` running). You get:

```typescript
// lib/tpl/welcomeEmail.ts — AUTO-GENERATED, do not edit

export interface WelcomeEmailVariables {
  userName: string;
  productName: string;
  planType: string;
}

export function welcomeEmail(vars: WelcomeEmailVariables): string {
  return `Write a warm welcome email to ${vars.userName}...`;
}
```

Now your prompt is:
- **Typed** — wrong variable = compile error, not a runtime surprise
- **Discoverable** — IntelliSense shows every prompt and its parameters
- **Co-located** — lives next to the feature it belongs to
- **Editable** — change the `.tpl.md`, never touch application logic

---

## Install

```bash
npm install -D the-prompting-library
# or
bun add -D the-prompting-library
# or
pnpm add -D the-prompting-library
```

## Quick start

**1. Add to your scripts:**

```json
{
  "scripts": {
    "dev": "tpl watch & next dev",
    "build": "tpl generate && next build"
  }
}
```

**2. Create a prompt file:**

```markdown
<!-- src/prompts/summarize.tpl.md -->
Summarize the following in {{wordCount}} words. Focus on {{topic}}.

Text: {{inputText}}
```

**3. Use the typed function:**

```typescript
import { summarize } from "./lib/tpl/index.js";

const prompt = summarize({
  wordCount: "50",
  topic: "key decisions",
  inputText: transcript,
});
```

That's it. IntelliSense works. Missing variables are compile errors.

---

## How it works

```
your .tpl.md files
       ↓
  fast-glob finds them all
       ↓
  variables extracted: {{camelCase}}
  includes resolved:   {{> shared/persona}}
       ↓
  lib/tpl/
    index.ts          ← re-exports everything
    summarize.ts      ← one file per prompt
    welcomeEmail.ts
    ...
```

Each prompt gets its own file. Delete a `.tpl.md` → its `.ts` file is removed on next generation. Import only what you need.

---

## File format

```markdown
---
description: Optional human-readable description (becomes JSDoc)
---

Your prompt goes here. Use {{variableName}} for variables.
Include other prompts with {{> shared/base-persona}}.
```

Frontmatter is **optional**. A file with just content is valid.

### Variables

- Syntax: `{{camelCase}}`
- All variables are `string` (prompts are strings — keep it simple)
- Duplicates are deduplicated; order of first appearance is preserved
- All variables are required — no optionals

### Includes

Share prompt snippets across files:

```markdown
<!-- src/shared/base-persona.tpl.md -->
You are a helpful, concise assistant. Respond professionally.
```

```markdown
<!-- src/features/email.tpl.md -->
{{> src/shared/base-persona}}

Write a welcome email to {{userName}}.
```

Includes always resolve from the **project root** — unambiguous regardless of where the including file lives. They're inlined at code generation time, not runtime.

---

## Output structure

```
lib/tpl/
  index.ts          ← import { welcomeEmail, summarize, prompts } from "./lib/tpl/index.js"
  welcomeEmail.ts   ← one file per prompt, easy to prune
  summarize.ts
  basePersona.ts
```

The `index.ts` re-exports everything and provides a `prompts` object if you need to enumerate at runtime:

```typescript
import { prompts } from "./lib/tpl/index.js";

// prompts.welcomeEmail({ ... })
// prompts.summarize({ ... })
```

---

## CLI

```bash
tpl generate          # one-shot — use in build scripts
tpl generate --output src/generated/prompts   # custom output dir

tpl watch             # reruns on every .tpl.md change (50ms debounce)
tpl watch --cwd ./packages/backend
```

---

## Configuration

Zero config by default. Customize via the `"tpl"` key in `package.json`:

```json
{
  "tpl": {
    "output": "lib/tpl",
    "pattern": "**/*.tpl.md",
    "ignore": ["src/vendor/**"]
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `output` | `"lib/tpl"` | Output directory (relative to project root) |
| `pattern` | `"**/*.tpl.md"` | Glob pattern for finding prompt files |
| `ignore` | `[]` | Additional patterns to ignore |

Always ignored: `node_modules`, `dist`, `.git`.

---

## Gitignore

Add the generated folder:

```gitignore
lib/tpl/
```

Regenerate at build time with `tpl generate`. It's fast.

---

## Naming

File name → function name:

| File | Function |
|------|----------|
| `welcome-email.tpl.md` | `welcomeEmail()` |
| `search-query.tpl.md` | `searchQuery()` |
| `classify.tpl.md` | `classify()` |

Two files with the same function name → error with both paths shown. Rename one.

---

## Adopt TPL in an existing codebase

Already have prompts scattered as inline strings? Paste this prompt into your AI agent — it will find every inlined prompt, extract it into `.tpl.md` files, and refactor the call sites to use typed functions.

<details>
<summary><strong>📋 Click to expand — AI agent adoption prompt</strong></summary>

```text
You are helping adopt TPL (The Prompting Library) in this codebase.

TPL turns scattered inline prompt strings into typed TypeScript functions. You drop
.tpl.md files anywhere in the repo, run `tpl generate`, and get fully-typed functions
with IntelliSense — wrong variables become compile errors, not runtime surprises.

───────────────────────────────────────────
STEP 1 — INSTALL TPL
───────────────────────────────────────────

Run the appropriate command for this project's package manager:

  npm install -D the-prompting-library
  # or: bun add -D the-prompting-library
  # or: pnpm add -D the-prompting-library

Then update package.json scripts so TPL runs automatically:

  "scripts": {
    "dev":   "tpl watch & <existing-dev-command>",
    "build": "tpl generate && <existing-build-command>"
  }

───────────────────────────────────────────
STEP 2 — FIND ALL INLINED PROMPTS
───────────────────────────────────────────

Search the entire codebase for inline prompt strings. Look for:

• Template literals or strings assigned to variables named:
    prompt, systemPrompt, userPrompt, systemMessage, instructions, or similar
• String arguments passed directly to AI SDK calls:
    generateText(), streamText(), chat.completions.create(),
    openai(), anthropic(), or any LLM client call
• Long strings in messages arrays: [{ role: "system", content: "..." }]
• Any string that contains instructions written in natural language to an LLM

For each match, note the file path, variable name, and which template variables
are interpolated into the string (${variable} or ${obj.property}).

───────────────────────────────────────────
STEP 3 — EXTRACT EACH PROMPT INTO A .tpl.md FILE
───────────────────────────────────────────

For each inlined prompt:

1. Create a .tpl.md file co-located with the source file that uses it.
   Naming convention: use kebab-case matching the prompt's purpose.
   Example: src/features/email/welcome-email.tpl.md

2. Paste the prompt body into the file. Replace every interpolated expression
   with a {{camelCase}} placeholder named after what it represents
   (not where it comes from).

3. Add an optional frontmatter description (helps with IntelliSense JSDoc):

   ---
   description: One-line description of what this prompt does
   ---

EXAMPLE — before (inline string in route.ts):

  const prompt = `Write a welcome email to ${user.name} for ${productName}.
  Their plan is ${user.subscription.tier}. Keep it under 150 words.`;

AFTER — src/features/email/welcome-email.tpl.md:

  ---
  description: Welcome email for new users
  ---

  Write a welcome email to {{userName}} for {{productName}}.
  Their plan is {{planType}}. Keep it under 150 words.

Variable rules:
• Always camelCase
• Name for what the value represents, not its origin (userName not userNameProp)
• All variables are required — no optional variables in TPL

───────────────────────────────────────────
STEP 4 — HANDLE SHARED CONTENT WITH INCLUDES
───────────────────────────────────────────

If you find repeated content across multiple prompts (e.g. a base persona,
safety guidelines, or output format instructions), extract it once:

  src/shared/base-persona.tpl.md:
    You are a helpful, concise assistant. Respond professionally.

Then reference it in other .tpl.md files:

  {{> src/shared/base-persona}}

  Write a welcome email to {{userName}}...

Includes always resolve from the project root, regardless of where the
including file lives. They are inlined at code-generation time, not runtime.

───────────────────────────────────────────
STEP 5 — RUN THE GENERATOR
───────────────────────────────────────────

  npx tpl generate

This scans the repo for all .tpl.md files and outputs one TypeScript file
per prompt into lib/tpl/ (configurable via "tpl" key in package.json).

Check the output — it should list every prompt you created with no errors.
If a prompt is missing, verify the file ends in .tpl.md and is not in
node_modules, dist, or .git.

───────────────────────────────────────────
STEP 6 — REFACTOR EVERY CALL SITE
───────────────────────────────────────────

Replace each inline prompt string with the generated typed function.

BEFORE:

  import { openai } from "@ai-sdk/openai";
  import { generateText } from "ai";

  const prompt = `Write a welcome email to ${user.name} for ${productName}...`;
  const { text } = await generateText({ model: openai("gpt-4o"), prompt });

AFTER:

  import { welcomeEmail } from "./lib/tpl/index.js";
  import { openai } from "@ai-sdk/openai";
  import { generateText } from "ai";

  const prompt = welcomeEmail({
    userName: user.name,
    productName,
    planType: user.subscription.tier,
  });
  const { text } = await generateText({ model: openai("gpt-4o"), prompt });

TypeScript will produce a compile error if you:
• Forget a required variable
• Pass a variable that does not exist in the template
• Pass a non-string value

───────────────────────────────────────────
STEP 7 — VERIFY
───────────────────────────────────────────

1. npx tpl generate     → should list N prompts with zero errors
2. tsc --noEmit         → no type errors at call sites
3. Run the test suite   → prompts should behave identically to before
4. Add lib/tpl/ to .gitignore — it is generated at build time

───────────────────────────────────────────
DONE
───────────────────────────────────────────

Every prompt in the codebase is now:
  ✓ Typed     — wrong variable = compile error, not a runtime surprise
  ✓ Visible   — IntelliSense shows every prompt and its parameters
  ✓ Editable  — change the .tpl.md, never touch application logic
  ✓ Co-located — lives next to the feature that uses it
```

</details>

---

## vs. AgentMark / Prompty

TPL is not an evaluation framework. It's not a runtime. It's a code generator — like Prisma for your prompts.

|  | TPL | AgentMark | Prompty |
|--|-----|-----------|---------|
| Format | Plain Markdown | MDX | YAML + Markdown |
| Config | Optional frontmatter | Required | Required |
| Output | Typed TS functions | Runtime object | Runtime object |
| Type safety | Compile-time | ✗ | ✗ |
| Dependencies at runtime | Zero | Yes | Yes |
| Evaluation built-in | ✗ | ✓ | ✓ |

---

## License

MIT
