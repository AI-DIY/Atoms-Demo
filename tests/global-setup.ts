import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

const testDatabaseUrl = "file:./test.db";
const rootDirectory = process.cwd();
const testDatabaseFiles = [
  "test.db",
  "test.db-journal",
  "test.db-shm",
  "test.db-wal",
].map((fileName) => path.join(rootDirectory, "prisma", fileName));

function removeTestDatabaseFiles() {
  for (const filePath of testDatabaseFiles) {
    if (path.dirname(filePath) !== path.join(rootDirectory, "prisma")) {
      throw new Error(`Unexpected test database path: ${filePath}`);
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

export default function setupTestDatabase() {
  process.env.DATABASE_URL = testDatabaseUrl;
  removeTestDatabaseFiles();

  execFileSync(
    findSchemaEngine(),
    ["cli", "--datasource", "file:./prisma/test.db", "create-database"],
    { cwd: rootDirectory, stdio: "inherit" },
  );

  execFileSync(
    process.execPath,
    [
      path.join(rootDirectory, "node_modules", "prisma", "build", "index.js"),
      "migrate",
      "deploy",
    ],
    {
      cwd: rootDirectory,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: "inherit",
    },
  );

  return removeTestDatabaseFiles;
}
