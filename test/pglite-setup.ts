import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

// Postgres en memoria para los tests de integración: nunca toca la BD real del .env.
// La URL la define vitest.config.mts (TEST_DATABASE_URL).

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  const db = await PGlite.create();
  // Varias conexiones (la de db push y la de Prisma); Prisma usa una sola a la vez (connection_limit=1)
  const server = new PGLiteSocketServer({ db, port: Number(url.port), host: "127.0.0.1", maxConnections: 10 });
  await server.start();

  // Asíncrono a propósito: PGlite atiende en este mismo proceso
  const code = await new Promise<number | null>((resolve) =>
    spawn("npx prisma db push --skip-generate", {
      env: { ...process.env, DATABASE_URL: url.href },
      stdio: "ignore",
      shell: true,
    }).on("exit", resolve)
  );
  if (code !== 0) throw new Error(`prisma db push falló (código ${code})`);

  return async () => {
    await server.stop();
    await db.close();
  };
}
