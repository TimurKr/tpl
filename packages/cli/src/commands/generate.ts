import path from "node:path";
import { generate } from "@tpl/core";
import { buildOptions, findProjectRoot, readConfig } from "../config.js";

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
      `Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }

  const config = readConfig(projectRoot);
  const generateOptions = buildOptions(projectRoot, config);

  if (options.output) {
    generateOptions.outputFile = path.resolve(cwd, options.output);
  }

  try {
    const result = await generate(generateOptions);
    const rel = path.relative(projectRoot, result.outputFile);
    process.stdout.write(`✓ Generated ${result.count} prompt(s) → ${rel}\n`);
    if (result.issues.length > 0) {
      process.stderr.write(`Generated prompts contain errors:\n`);
      for (const issue of result.issues) {
        process.stderr.write(
          `  ${issue.kind.padEnd(14)} ${path.relative(projectRoot, issue.filePath)}\n`,
        );
      }
      process.exit(1);
    }
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}
