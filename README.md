<p align="center">
  <img src="logo.png" alt="TPL logo" width="240" />
</p>

# TPL — The Prompting Library

Stop hiding your prompts in backticks.

TPL lets prompts live in plain `.tpl.md` files, then generates typed TypeScript functions you can import from your app.

No dashboard. No hosted runtime. No "prompt management platform" with a pricing page and a haunted enterprise sales form.

Just files in your repo.

```markdown
<!-- base-persona.tpl.md -->
You are a helpful, concise assistant. Respond professionally.
```

```markdown
<!-- welcome-email.tpl.md -->
{{> basePersona}}

Write a warm welcome email to {{userName}} who just signed up for {{productName}}.
Their plan is {{planType}}. Keep it under 150 words.
```

```typescript
import { generateText } from "ai";
import { prompts } from "./lib/tpl.gen.js";

const { text } = await generateText({
  model,
  prompt: prompts.welcomeEmail({
    // autocomplete works here
    userName: "Alice",
    productName: "Acme AI",
    planType: "Pro",
    // missing field? wrong name? wrong type? TypeScript yells before prod does.
  }),
});
```

## Why This Exists

- Prompts are product code. They deserve review, diffs, search, comments, and ownership.
- Inline prompt strings rot. Types keep call sites honest.
- AI coding agents understand files better than mystery strings buried in handlers.
- Markdown is the best prompt editor we already have.

## Quick start

Paste this to your coding agent:

```text
Add TPL to this repo. Read the full agent setup prompt in the TPL README and follow it closely: https://github.com/TimurKr/tpl#quick-start
```

Want to review what you just asked the machine to do? Expand this:

<details>
<summary><strong>See the full agent setup prompt</strong></summary>

```text
You are helping add TPL (The Prompting Library) to this TypeScript codebase.

Goal:
Move prompt text out of inline strings and into .tpl.md files. TPL will generate typed TypeScript prompt builder functions so prompt call sites get autocomplete and compile-time checks.

What TPL does:
- Source prompts live in .tpl.md, .tpl.mdx, .tpl.txt, or .tpl.html files.
- Running `tpl generate` creates sibling `*.tpl.gen.ts` files.
- Running `tpl generate` also creates a manifest at `lib/tpl.gen.ts` by default.
- App code imports from `./lib/tpl.gen.js` and calls `prompts.promptName(...)`.
- Generated files are disposable. Do not hand-edit them.

Important syntax:
- `{{name}}` becomes a required string variable.
- `{{count:number}}` becomes a required number variable.
- `{{active:boolean}}` becomes a required boolean variable.
- `{{tags:string[]}}` becomes a required string array variable.
- `{{tone|friendly}}` becomes an optional string with a default.
- `{{limit:number|10}}` becomes an optional number with a default.
- `{{#if note}}...{{/if}}` renders only when `note` is truthy.
- `{{> basePersona}}` includes another template.

Implementation steps:

1. Inspect the project.
   - Detect the package manager.
   - Detect the main app scripts.
   - Detect whether generated files are committed in this repo.
   - Check TypeScript module settings so imports use the right style.

2. Install TPL as a dev dependency.
   - npm: `npm install -D the-prompting-library`
   - pnpm: `pnpm add -D the-prompting-library`
   - bun: `bun add -D the-prompting-library`
   - yarn: `yarn add -D the-prompting-library`

3. Add scripts.
   - Development: run `tpl watch` alongside the normal dev server.
     Example: `"dev": "tpl watch & next dev"`
   - Build/CI: run `tpl generate` before typecheck/build.
     Example: `"build": "tpl generate && next build"`
   - If the repo has a separate typecheck script, ensure `tpl generate` runs before it in CI.
   - If generated files are committed, add `tpl check` to CI to catch drift.

4. Find inline prompts.
   Search for:
   - template literals or strings assigned to names like `prompt`, `systemPrompt`, `userPrompt`, `instructions`, `systemMessage`
   - AI SDK calls such as `generateText`, `streamText`, `generateObject`, `streamObject`
   - OpenAI/Anthropic calls and `messages` arrays
   - objects like `{ role: "system", content: "..." }`
   - repeated persona, tone, safety, formatting, or output schema instructions

5. Extract each prompt.
   - Create a `.tpl.md` file next to the code that uses the prompt.
   - Use kebab-case names: `welcome-email.tpl.md`, `classify-ticket.tpl.md`.
   - Add frontmatter when useful:
     ---
     description: Welcome email for new users
     ---
   - Replace interpolated expressions with TPL variables.
   - Add type hints for non-string values.
   - Use defaults for optional values.
   - Use `{{#if var}}...{{/if}}` for optional sections.

6. Extract shared prompt text.
   - Move repeated persona, safety rules, response style, and output format text into partial templates.
   - Example: `src/prompts/base-persona.tpl.md`
   - Include with `{{> basePersona}}`.
   - Partials without variables are rendered automatically.
   - Partials with variables become nested typed fields.

7. Generate files.
   - Run `tpl generate`.
   - Confirm each template has a sibling `*.tpl.gen.ts`.
   - Confirm the manifest exists at `lib/tpl.gen.ts` unless the project configured another output.
   - Do not edit generated files manually.

8. Refactor call sites.
   Replace inline strings with generated prompt functions.

   Before:
     const prompt = `Write a welcome email to ${user.name}. Plan: ${plan}.`;

   Template:
     src/features/email/welcome-email.tpl.md
     ---
     description: Welcome email for new users
     ---
     Write a welcome email to {{userName}}. Plan: {{planType}}.

   After:
     import { prompts } from "./lib/tpl.gen.js";

     const { text } = await generateText({
       model,
       prompt: prompts.welcomeEmail({
         userName: user.name,
         planType: plan,
       }),
     });

9. Verify.
   - Run `tpl generate`.
   - Run the repo's typecheck.
   - Run the repo's tests if they exist.
   - Fix any generated TypeScript errors by correcting template variables, duplicate names, or broken includes.

10. Report what changed.
   - List installed package/script changes.
   - List created `.tpl.md` files.
   - List refactored call sites.
   - Mention any prompts intentionally left inline and why.
```

</details>

Manual setup:

### 1. Install

```bash
npm install -D the-prompting-library
```

### 2. Add scripts

```json
{
  "scripts": {
    "dev": "tpl watch & next dev",
    "build": "tpl generate && next build"
  }
}
```

Replace `next dev` / `next build` with your app's commands, or run `tpl watch` in a separate terminal.

### 3. Create a prompt

```markdown
<!-- src/features/auth/welcome-email.tpl.md -->
Write a welcome email to {{userName}} for {{productName}}.
Keep it under {{wordCount:number|150}} words.
```

### 4. Run the watcher

```bash
npm run dev
```

TPL writes:

```text
src/features/auth/welcome-email.tpl.gen.ts
lib/tpl.gen.ts
lib/tpl.gen.env.d.ts
```

### 5. Use it

```typescript
import { prompts } from "./lib/tpl.gen.js";

const prompt = prompts.welcomeEmail({
  userName: "Alice",
  productName: "Acme AI",
});
```

`wordCount` is optional because the template has a default. `userName` and `productName` are required because the template says so.

## What You Get

- `*.tpl.md` prompt files that sit next to the code that uses them.
- Sibling `*.tpl.gen.ts` files with typed builder functions.
- A manifest at `lib/tpl.gen.ts` with `prompts.<name>()` and `renderPrompt()`.
- Compile-time errors for missing variables, wrong variable names, duplicate prompt names, and broken includes.
- `tpl watch` for development, `tpl generate` for builds, `tpl check` for CI drift checks.

## Template Syntax

Variables:

```markdown
{{name}}              required string
{{count:number}}      required number
{{active:boolean}}    required boolean
{{tags:string[]}}     required string array
{{tone|friendly}}     optional string with default
{{limit:number|10}}   optional number with default
```

Conditionals:

```markdown
{{#if note}}
Note: {{note}}
{{/if}}
```

Includes:

```markdown
{{> basePersona}}

Write a support reply to {{customerName}}.
```

Includes can use a short name like `basePersona`, a kebab name like `base-persona`, or a path suffix like `shared/base-persona`.

Partials with no variables are rendered automatically. Partials with variables become nested typed fields, so callers only pass what is actually needed.

## Naming

File names become function names:

```text
welcome-email.tpl.md  -> prompts.welcomeEmail()
search-query.tpl.md   -> prompts.searchQuery()
classify.tpl.md       -> prompts.classify()
```

You can also import a single builder:

```typescript
import { buildWelcomeEmailPrompt } from "./src/features/auth/welcome-email.tpl.gen.js";
```

Prompt names must be unique across the project. If two files map to the same name, TPL generates a TypeScript error that points at both files.

## CLI

```bash
tpl watch                  # dev mode: generate, then regenerate on changes
tpl generate               # one-shot generation for builds and CI
tpl check                  # fail if generated files are stale

tpl generate --cwd apps/api
tpl generate --output src/generated/prompts.gen.ts
```

## Configuration

Zero config by default. Add a `tpl` key to `package.json` only when you want to change paths:

```json
{
  "tpl": {
    "output": "lib/tpl.gen.ts",
    "pattern": "**/*.tpl.{md,mdx,txt,html}",
    "ignore": ["src/vendor/**"]
  }
}
```

Defaults:

- `output`: `lib/tpl.gen.ts`
- `pattern`: `**/*.tpl.{md,mdx,txt,html}`
- `ignore`: `[]`

Always ignored: `node_modules`, `dist`, `.git`.

## TypeScript Notes

Generated files use ESM-friendly `.js` specifiers in relative imports:

```typescript
import { prompts } from "./lib/tpl.gen.js";
```

With TypeScript `Node16` / `NodeNext`, this is correct: TypeScript resolves the `.js` specifier to the `.ts` file during development, and emitted relative imports stay valid in strict ESM.

Generated prompt modules import source templates as text:

```typescript
import TEMPLATE from "./welcome-email.tpl.md" with { type: "text" };
```

TPL also generates `tpl.gen.env.d.ts` so TypeScript understands `.tpl.md`, `.tpl.mdx`, `.tpl.txt`, and `.tpl.html` imports.

Your runtime or bundler still needs to load those template files as text. Bun supports this style directly; framework setup may need a text/raw-file loader.

## Why Not Just Use Strings?

Strings are fine until they are not.

Then you have twenty prompts, five product surfaces, three model providers, a pile of copied instructions, and one typo named `usrName` waiting patiently for demo day.

TPL keeps the boring parts boring:

- prompts stay readable,
- variables stay typed,
- repeated text gets reused,
- generated files stay disposable,
- your app imports normal functions.

## Repository Layout

```text
packages/core   parser, resolver, runtime, code generation
packages/cli    tpl command: generate, watch, check
apps/example    runnable example project
apps/docs       documentation site
```

Local development:

```bash
bun install
bun run build
bun run test
bun run dev:example
```

## License

MIT
