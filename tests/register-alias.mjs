import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = path.join(rootDir, specifier.slice(2));
      const resolved = fs.existsSync(`${base}.ts`)
        ? `${base}.ts`
        : path.join(base, "index.ts");
      return nextResolve(pathToFileURL(resolved).href, context);
    }
    return nextResolve(specifier, context);
  },
});
