import { Command } from "commander";
import { runCheck } from "./commands/check.js";
import { runGenerate } from "./commands/generate.js";
import { runWatch } from "./commands/watch.js";

const program = new Command();

program
  .name("tpl")
  .description(
    "The Prompting Library — generate typed functions from .tpl.md files",
  )
  .version("0.1.0");

program
  .command("generate")
  .alias("g")
  .description("Generate typed prompt files from all .tpl.* files (one-shot)")
  .option("--cwd <dir>", "Working directory (defaults to process.cwd())")
  .option("--output <path>", "Override output file path")
  .action(async (opts) => {
    await runGenerate({ cwd: opts.cwd, output: opts.output });
  });

program
  .command("check")
  .alias("c")
  .description("Check generated prompt files are up to date")
  .option("--cwd <dir>", "Working directory (defaults to process.cwd())")
  .option("--output <path>", "Override output file path")
  .action(async (opts) => {
    await runCheck({ cwd: opts.cwd, output: opts.output });
  });

program
  .command("watch")
  .alias("w")
  .description("Watch for .tpl.* changes and regenerate automatically")
  .option("--cwd <dir>", "Working directory (defaults to process.cwd())")
  .option("--output <path>", "Override output file path")
  .action(async (opts) => {
    await runWatch({ cwd: opts.cwd, output: opts.output });
  });

program.parse();
