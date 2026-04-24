// This file shows how you'd use the generated prompts in your app.
// Run `tpl watch` during development — it regenerates on every .tpl.md save.

// Recommended: import the prompts object and use short names
// import { prompts } from "../lib/prompts/index.ts";
//
// const prompt = prompts.welcomeEmail({
//   userName: "Alice",
//   productName: "Acme AI",
//   planType: "Pro",
//   basePersona: {},
// });
// console.log(prompt);

// For tree-shaking / single import use the build function directly:
// import { buildWelcomeEmailPrompt } from "../lib/prompts/welcomeEmail.ts";

// For dynamic dispatch by name:
// import { renderPrompt } from "../lib/prompts/index.ts";
//
// const prompt = renderPrompt("welcomeEmail", { userName: "Alice", ... });

console.log("Run `tpl watch` during development.");
console.log("Run `tpl generate` in CI/CD.");
console.log("Generated prompts live in lib/prompts/.");
