import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".next/**"],
    environment: "node",
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "~": appRoot,
      shared: `${repoRoot}/packages/shared`,
      db: `${repoRoot}/packages/db`,
      types: `${repoRoot}/packages/shared/types`,
    },
  },
});
