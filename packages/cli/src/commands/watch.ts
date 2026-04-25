import path from "path";
import chokidar from "chokidar";
import { generate } from "@tpl/core";
import { findProjectRoot, readConfig, buildOptions } from "../config.js";

export async function runWatch(options: {
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
    generateOptions.outputFile = path.resolve(cwd, options.output);
  }

  const runGen = async (changedFile?: string) => {
    if (changedFile) {
      process.stdout.write(`~ Detected change: ${changedFile}\n`);
    }

    try {
      const result = await generate(generateOptions);
      const rel = path.relative(projectRoot, result.outputFile);
      process.stdout.write(`✓ Generated ${result.count} prompt(s) → ${rel}\n`);
    } catch (err) {
      process.stderr.write(
        `Error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  };

  // Initial generate on startup
  await runGen();

  process.stdout.write(`👁  Watching for .tpl.* changes in ${projectRoot}\n`);

  const watcher = chokidar.watch(generateOptions.pattern ?? "**/*.tpl.{md,mdx,txt,html}", {
    cwd: projectRoot,
    ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**", ...(generateOptions.ignore ?? [])],
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingFile: string | null = null;

  const schedule = (filePath: string) => {
    pendingFile = filePath;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      const file = pendingFile;
      pendingFile = null;
      await runGen(file ?? undefined);
    }, 50);
  };

  watcher
    .on("add", (filePath) => schedule(filePath))
    .on("change", (filePath) => schedule(filePath))
    .on("unlink", (filePath) => schedule(filePath));

  const shutdown = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    try {
      await watcher.close();
    } catch {
      // ignore errors during shutdown
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
