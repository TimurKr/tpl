import path from "node:path";
import { check } from "@tpl/core";
import { buildOptions, findProjectRoot, readConfig } from "../config.js";

export async function runCheck(options: {
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
  const checkOptions = buildOptions(projectRoot, config);

  if (options.output) {
    checkOptions.outputFile = path.resolve(cwd, options.output);
  }

  try {
    const result = await check(checkOptions);
    const rel = path.relative(projectRoot, result.outputFile);

    if (result.ok) {
      process.stdout.write(`✓ Generated prompts are up to date → ${rel}\n`);
      return;
    }

    process.stderr.write(
      `Generated prompts are out of date. Run \`tpl generate\`.\n`,
    );
    for (const issue of result.issues) {
      process.stderr.write(
        `  ${issue.kind.padEnd(7)} ${path.relative(projectRoot, issue.filePath)}\n`,
      );
    }
    process.exit(1);
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}
