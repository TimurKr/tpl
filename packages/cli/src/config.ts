import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { GenerateOptions, TplConfig } from "@tpl/core";

export function findProjectRoot(cwd: string): string {
  let dir = path.resolve(cwd);

  while (true) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find a package.json starting from: ${cwd}\nMake sure you're running tpl inside a Node.js project.`,
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

export function buildOptions(
  projectRoot: string,
  config: TplConfig,
): GenerateOptions {
  const output = config.output ?? "lib/tpl.gen.ts";
  const defaultTypesOutput = path.join(path.dirname(output), "tpl.d.ts");

  return {
    rootDir: projectRoot,
    outputFile: path.join(projectRoot, output),
    typesOutputFile: path.join(
      projectRoot,
      config.typesOutput ?? defaultTypesOutput,
    ),
    pattern: config.pattern ?? "**/*.tpl.{md,mdx,txt,html}",
    ignore: config.ignore ?? [],
    namespaceAliases: config.namespaceAliases ?? {},
    importSpecifierExtension: config.importSpecifierExtension,
    templateSource: config.templateSource,
    templateImportAttributeType: config.templateImportAttributeType,
    postprocess: config.postprocess,
  };
}
