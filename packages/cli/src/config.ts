import path from "path";
import { readFileSync, existsSync } from "fs";
import type { TplConfig, GenerateOptions } from "@tpl/core";

export function findProjectRoot(cwd: string): string {
  let dir = path.resolve(cwd);

  while (true) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find a package.json starting from: ${cwd}\nMake sure you're running tpl inside a Node.js project.`
      );
    }

    dir = parent;
  }
}

export function readConfig(projectRoot: string): TplConfig {
  const pkgPath = path.join(projectRoot, "package.json");
  const raw = readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  if (pkg.tpl && typeof pkg.tpl === "object" && !Array.isArray(pkg.tpl)) {
    return pkg.tpl as TplConfig;
  }

  return {};
}

export function buildOptions(projectRoot: string, config: TplConfig): GenerateOptions {
  return {
    rootDir: projectRoot,
    outputDir: path.join(projectRoot, config.output ?? "lib/tpl"),
    pattern: config.pattern ?? "**/*.tpl.md",
    ignore: config.ignore ?? [],
  };
}
