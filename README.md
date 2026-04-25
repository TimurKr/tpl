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
Add TPL to this repo. Fetch the raw TPL README, read the full agent setup prompt under Quick start, and follow it closely: https://raw.githubusercontent.com/TimurKr/tpl/main/README.md
```

Want to review what you just asked the machine to do? Expand this:

<details>
<summary><strong>See the full agent setup prompt</strong></summary>

```text
You are helping add TPL (The Prompting Library) to this TypeScript codebase.

Goal:
Move real prompt prose out of inline strings and into .tpl.md files. TPL will generate typed TypeScript prompt builder functions so prompt call sites get autocomplete and compile-time checks.

Do not only "move strings around." TPL should become the main prompt-building mechanism. Use this as a chance to make prompt ownership clearer.

Target architecture:
- Markdown templates should own the model-facing prompt: headings, labels, descriptions, separators, fallback text, truncation notes, ordering notes, and conditional wording.
- TypeScript should gather and normalize data, then pass that data into generated prompt functions.
- TypeScript should not keep building prompt prose with string concatenation, arrays of hard-coded prompt lines, or helper functions whose main job is formatting model-facing text.
- Prefer one top-level template for a full prompt, such as `assistant-instructions.tpl.md`, with variables and partials for sections.
- Ideally the app ends with one obvious call like `prompts.systemPrompt({...})`. If dynamic repeated sections are needed, render each item with an item template, join those rendered items, and pass the result into the top-level template.
- It is okay for TypeScript to compute facts like file contents, counts, config values, booleans, and lists. It is not okay for TypeScript to remain the place where prompt wording is authored.

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
   - Detect whether this is a monorepo and which package owns the prompts.
   - Detect the main app scripts.
   - Detect whether generated files are committed in this repo.
   - Check TypeScript module settings so imports use the right style.
   - Prefer package-local TPL config/output in monorepos. Do not make unrelated packages depend on one package's generated template declarations unless the repo already shares source that way.

2. Install TPL as a dev dependency.
   - npm: `npm install -D the-prompting-library`
   - pnpm: `pnpm add -D the-prompting-library`
   - bun: `bun add -D the-prompting-library`
   - yarn: `yarn add -D the-prompting-library`

3. Add scripts.
   - Development: run `tpl watch` alongside the normal dev server.
     Example: `"dev": "tpl watch & next dev"`
   - If the repo already uses a parallel runner, use that instead of shell `&`.
   - If `&` would be brittle, add a separate `dev:tpl` script and document that it should run beside the app dev server.
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

5. Decide what should become a template.
   - Extract large human-authored prompt prose, reusable instructions, output contracts, personas, safety rules, integration guides, and model-facing explanations.
   - Extract section formats when they are part of the final prompt. For example, a source-document section template should contain the heading, explanation, fallback wording, and `{{body}}` placeholder.
   - Extract conditional prompt wording into templates with `{{#if var}}...{{/if}}` instead of building those sentences in TypeScript.
   - Do not extract tiny non-prompt UI labels or generic string utilities just because they contain text.
   - If TypeScript is still deciding how the prompt reads, move that wording into a template.

6. Restructure prompt-heavy code by feature before extracting.
   - If one file owns many unrelated prompt sections, split it into small feature/domain modules as part of the migration.
   - Each feature folder should own both the TypeScript that gathers data and the `.tpl.md` files that describe that feature's prompt text.
   - Do not create a central `src/prompts/` dumping ground for feature-owned prompts.
   - A central prompt folder is only acceptable for genuinely shared templates such as base persona, safety rules, or output format.
   - Good target shape:
     src/
       billing/
         invoice-summary.ts
         invoice-summary.tpl.md
       search/
         query-rewrite.ts
         query-rewrite.tpl.md
       support/
         ticket-classifier.ts
         ticket-classifier.tpl.md
   - Bad target shape:
     src/
       prompts/
         invoice-summary.tpl.md
         query-rewrite.tpl.md
         ticket-classifier.tpl.md
       giant-prompt-assembler.ts
   - If the migration ends with one unchanged giant assembler plus a folder full of unrelated templates, the migration is incomplete. Refactor the assembler into feature modules and colocate the templates.

7. Extract each chosen prompt.
   - Use kebab-case names: `welcome-email.tpl.md`, `classify-ticket.tpl.md`.
   - Add frontmatter when useful:
     ---
     description: Welcome email for new users
     ---
   - Replace interpolated expressions with TPL variables.
   - Add type hints for non-string values.
   - Use defaults for optional values.
   - Use `{{#if var}}...{{/if}}` for optional sections.

8. Extract shared prompt text.
   - Move repeated persona, safety rules, response style, and output format text into partial templates.
   - Example: `src/prompts/base-persona.tpl.md`
   - Include with `{{> basePersona}}`.
   - Partials without variables are rendered automatically.
   - Partials with variables become nested typed fields.

9. Create a top-level prompt template when assembling a large prompt.
   - If the original code had one big `systemPrompt` or prompt assembler, create a top-level `.tpl.md` file for that final prompt.
   - Put the final order, section headings, separators, and section inclusion rules in that top-level template.
   - Use variables for dynamic data: `{{userContext}}`, `{{retrievedDocuments}}`, `{{availableActions}}`, `{{responseRules}}`.
   - Use partials for static or reusable sections: `{{> basePersona}}`, `{{> safetyRules}}`, `{{> outputFormat}}`.
   - The TypeScript assembler should become mostly data loading plus a final call to the generated top-level prompt function.

10. Generate files.
   - Run `tpl generate`.
   - Confirm each template has a sibling `*.tpl.gen.ts`.
   - Confirm the manifest exists at `lib/tpl.gen.ts` unless the project configured another output.
   - Do not edit generated files manually.
   - Decide whether generated files should be committed by following the repo's existing convention. If source typechecks on clean checkout without running generation, commit them. If CI always generates first, they may be ignored.
   - Ensure the generated `tpl.d.ts` is included by TypeScript. Generated files reference it automatically, but custom TS project boundaries may still require including it explicitly.

11. Refactor call sites.
   Replace inline strings with generated prompt functions.
   Prefer importing from the generated manifest/barrel:
     import { prompts } from "./lib/tpl.gen.js";
   Use direct generated-file imports only when bundle size, client/server boundaries, or package boundaries make the barrel undesirable.

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

   Remove wrapper-only functions created by the refactor.

   Bad:
     function buildWelcomeEmailPrompt(...args): string {
       return prompts.welcomeEmail(...args);
     }

   Better:
     const prompt = prompts.welcomeEmail(...args);

   Keep a wrapper only when it preserves a public API, adds real logic, validates input, or is needed for compatibility. Otherwise update callers to use the generated prompt function directly.

12. Verify.
   - Run `tpl generate`.
   - Run the repo's typecheck.
   - Run the repo's tests if they exist.
   - Fix any generated TypeScript errors by correcting template variables, duplicate names, or broken includes.
   - Review the diff for under-extraction. If prompt wording, headings, descriptions, separators, truncation notes, or conditional prose are still authored in TypeScript, move them into templates.
   - Review the diff for over-extraction. If a `.tpl.md` file is only a non-prompt utility string, move it back to TypeScript.
   - Review folder structure. If everything landed in one prompt folder, reorganize by feature where reasonable.
   - Search for wrapper-only functions and remove them unless they have a real reason to exist.
   - Check that large prompt assembly flows through a top-level generated prompt function where practical.

13. Report what changed.
   - List installed package/script changes.
   - List created `.tpl.md` files.
   - List refactored call sites.
   - List any feature folders created or reorganized.
   - List wrapper-only functions removed.
   - Mention any prompts intentionally left inline and why.
```

</details>

## Manual setup:

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
lib/tpl.d.ts
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

If a variable only appears in a conditional, it is typed as `boolean | undefined`. If it also appears as `{{note}}`, `{{note:number}}`, or another variable expression, TPL uses that variable's declared type and marks it optional.

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

TPL also generates `tpl.d.ts` so TypeScript understands `.tpl.md`, `.tpl.mdx`, `.tpl.txt`, and `.tpl.html` imports. Generated files reference it automatically, but a separate TypeScript project that imports source across package boundaries may still need to include that file or define equivalent ambient declarations.

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
