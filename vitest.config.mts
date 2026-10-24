import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Postgres en memoria (PGlite) que levanta test/pglite-setup.ts
const TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connect_timeout=30&connection_limit=1";
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.db.test.ts"] },
      },
      {
        // Repositorio contra Postgres real en memoria (PGlite)
        resolve: {
          alias: { ...alias, "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)) },
        },
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["./test/pglite-setup.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL },
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
