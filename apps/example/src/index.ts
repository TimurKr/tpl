// This file shows how you'd use the generated prompts in your app.
// In dev, run `tpl watch` (see package.json) — it regenerates on every .tpl.md save.
// In CI, `tpl generate` runs before the build so output is always fresh.

// Recommended: import the prompts object and use path-based names.
// This example aliases "src/features" to "" in package.json, so feature prompts
// live under prompts.auth/search/support instead of prompts.features....
// import { prompts } from "../lib/tpl.gen.js";
//
// const prompt = prompts.auth.welcomeEmail({
//   userName: "Alice",
//   productName: "Acme AI",
//   planType: "Pro",
//   persona: {},
// });
// console.log(prompt);

// For tree-shaking / single import use the build function directly:
// import { buildWelcomeEmailPrompt } from "./features/auth/welcome-email.tpl.gen.js";

// For dynamic dispatch by name:
// import { renderPrompt } from "../lib/tpl.gen.js";
//
// const prompt = renderPrompt("auth.welcomeEmail", { userName: "Alice", ... });

console.log("Run `bun run dev` or `tpl watch` during development.");
console.log("Run `tpl generate` in CI (see build script on the monorepo).");
console.log("Generated prompt modules live beside their .tpl.* sources.");
console.log(
  'The generated manifest lives at lib/tpl.gen.ts (see package.json "tpl").',
);
