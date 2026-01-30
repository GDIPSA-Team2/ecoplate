import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

const dbPath = "ecoplate.db";
const migrationFiles = [
  join(import.meta.dir, "migrations", "0000_yummy_frank_castle.sql"),
  join(import.meta.dir, "migrations", "0001_ancient_the_fallen.sql"),
];

console.log("Running database migration...\n");

try {
  const sqlite = new Database(dbPath);

  for (const migrationFile of migrationFiles) {
    console.log(`Running: ${migrationFile}`);
    const migration = readFileSync(migrationFile, "utf-8");

    const statements = migration
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      sqlite.exec(statements[i]);
    }
  }

  sqlite.close();

  console.log("\n✓ Migration completed successfully!");
  console.log("\nNext steps:");
  console.log("  1. Run: bun run db:seed");
  console.log("  2. Start server: bun run dev\n");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
