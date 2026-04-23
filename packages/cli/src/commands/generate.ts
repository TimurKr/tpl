import path from "path";
import { generate } from "@tpl/core";
import { findProjectRoot, readConfig, buildOptions } from "../config.js";

export async function runGenerate(options: {
  cwd?: string;
  output?: string;
}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  let projectRoot: string;
  try {
    projectRoot = findProjectRoot(cwd);
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }

  const config = readConfig(projectRoot);
  const generateOptions = buildOptions(projectRoot, config);

  if (options.output) {
    generateOptions.outputDir = path.resolve(cwd, options.output);
  }

  try {
    const result = await generate(generateOptions);
    const rel = path.relative(projectRoot, result.outputDir);
    process.stdout.write(`✓ Generated ${result.count} prompt(s) → ${rel}/\n`);
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
