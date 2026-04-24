// This file shows how you'd use the generated prompts in your app.
// In dev, run `tpl watch` (see package.json) — it regenerates on every .tpl.md save.
// In CI, `tpl generate` runs before the build so output is always fresh.

// Recommended: import the prompts object and use short names
// import { prompts } from "../lib/tpl/index.js";
//
// const prompt = prompts.welcomeEmail({
//   userName: "Alice",
//   productName: "Acme AI",
//   planType: "Pro",
//   basePersona: {},
// });
// console.log(prompt);

// For tree-shaking / single import use the build function directly:
// import { buildWelcomeEmailPrompt } from "../lib/tpl/welcomeEmail.js";

// For dynamic dispatch by name:
// import { renderPrompt } from "../lib/tpl/index.js";
//
// const prompt = renderPrompt("welcomeEmail", { userName: "Alice", ... });

console.log("Run `bun run dev` or `tpl watch` during development.");
console.log("Run `tpl generate` in CI (see build script on the monorepo).");
console.log("Generated prompts live in lib/tpl/ (see package.json \"tpl\").");
