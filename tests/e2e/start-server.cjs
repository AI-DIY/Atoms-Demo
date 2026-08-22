const { execFileSync, spawn } = require("node:child_process");
const { readdirSync, rmSync } = require("node:fs");
const path = require("node:path");

const rootDirectory = path.resolve(__dirname, "..", "..");
const databaseDirectory = path.join(rootDirectory, "prisma");
const databaseUrl = "file:./e2e.db";
const databaseFiles = ["e2e.db", "e2e.db-journal", "e2e.db-shm", "e2e.db-wal"]
  .map((fileName) => path.join(databaseDirectory, fileName));

function removeE2eDatabaseFiles() {
  for (const filePath of databaseFiles) {
    if (path.dirname(filePath) !== databaseDirectory) {
      throw new Error(`Unexpected E2E database path: ${filePath}`);
    }

    rmSync(filePath, { force: true });
  }
}

function findSchemaEngine() {
  const pnpmDirectory = path.join(rootDirectory, "node_modules", ".pnpm");
  const enginePackage = readdirSync(pnpmDirectory).find((entry) =>
    entry.startsWith("@prisma+engines@"),
  );

  if (!enginePackage) {
    throw new Error("Prisma schema engine package was not found");
  }

  const enginesDirectory = path.join(
    pnpmDirectory,
    enginePackage,
    "node_modules",
    "@prisma",
    "engines",
  );
  const schemaEngine = readdirSync(enginesDirectory).find(
    (entry) => entry.startsWith("schema-engine-") && !entry.includes(".tmp"),
  );

  if (!schemaEngine) {
    throw new Error("Prisma schema engine binary was not found");
  }

  return path.join(enginesDirectory, schemaEngine);
}

const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  MOCK_LLM: "true",
};

removeE2eDatabaseFiles();
execFileSync(
  findSchemaEngine(),
  ["cli", "--datasource", "file:./prisma/e2e.db", "create-database"],
  { cwd: rootDirectory, stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [
    path.join(rootDirectory, "node_modules", "prisma", "build", "index.js"),
    "migrate",
    "deploy",
  ],
  { cwd: rootDirectory, env: environment, stdio: "inherit" },
);

const server = spawn(
  process.execPath,
  [
    path.join(rootDirectory, "node_modules", "next", "dist", "bin", "next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { cwd: rootDirectory, env: environment, stdio: "inherit", windowsHide: true },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
