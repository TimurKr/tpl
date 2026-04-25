// This file shows how you'd use the generated prompts in your app.
// In dev, run `tpl watch` (see package.json) — it regenerates on every .tpl.md save.
// In CI, `tpl generate` runs before the build so output is always fresh.

// Recommended: import the prompts object and use short names
// import { prompts } from "../lib/tpl.gen.js";
//
// const prompt = prompts.welcomeEmail({
//   userName: "Alice",
//   productName: "Acme AI",
//   planType: "Pro",
//   basePersona: {},
// });
// console.log(prompt);

// For tree-shaking / single import use the build function directly:
// import { buildWelcomeEmailPrompt } from "./features/auth/welcome-email.tpl.gen.js";

// For dynamic dispatch by name:
// import { renderPrompt } from "../lib/tpl.gen.js";
//
// const prompt = renderPrompt("welcomeEmail", { userName: "Alice", ... });

console.log("Run `bun run dev` or `tpl watch` during development.");
console.log("Run `tpl generate` in CI (see build script on the monorepo).");
console.log("Generated prompt modules live beside their .tpl.* sources.");
console.log("The generated manifest lives at lib/tpl.gen.ts (see package.json \"tpl\").");
