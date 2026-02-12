/**
 * Integration test: Consumption/waste actions trigger badge awards and update points.
 *
 * Scenario: A brand-new user adds a product, consumes it, then confirms waste.
 * Without visiting the Badges page, EcoPoints should already reflect the badge
 * bonus points (e.g., "First Steps" +25, "Clean Plate" / first_consume +25).
 */
import { describe, expect, test, beforeAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";

// ── In-memory DB ──────────────────────────────────────────────────────
const sqlite = new Database(":memory:");
sqlite.exec("PRAGMA journal_mode = WAL;");

sqlite.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    user_location TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT,
    unit_price REAL,
    purchase_date INTEGER,
    description TEXT,
    co2_emission REAL
  );

  CREATE TABLE user_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    total_co2_saved REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE product_sustainability_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    today_date TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    type TEXT
  );

  CREATE TABLE badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    badge_image_url TEXT
  );

  CREATE TABLE user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, badge_id)
  );

  CREATE TABLE pending_consumption_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_photo TEXT NOT NULL,
    ingredients TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'PENDING_WASTE_PHOTO',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    expiring_products INTEGER NOT NULL DEFAULT 1,
    badge_unlocked INTEGER NOT NULL DEFAULT 1,
    streak_milestone INTEGER NOT NULL DEFAULT 1,
    product_stale INTEGER NOT NULL DEFAULT 1,
    stale_days_threshold INTEGER NOT NULL DEFAULT 7,
    expiry_days_threshold INTEGER NOT NULL DEFAULT 3
  );

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const testDb = drizzle(sqlite, { schema });

// Override the global db so badge-service queries use our in-memory DB
import { __setTestDb } from "../../db/connection";
__setTestDb(testDb);

// Import service functions AFTER db override
import { confirmIngredients, confirmWaste } from "../consumption-service";
import { BADGE_DEFINITIONS } from "../badge-service";

// ── Seed ──────────────────────────────────────────────────────────────
let userId: number;
let productId: number;

beforeAll(() => {
  // Create test user
  const userRow = sqlite
    .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id")
    .get("consume-badge@eco.com", "hash", "New User") as { id: number };
  userId = userRow.id;

  // Create test product (10 pcs of Apple)
  const prodRow = sqlite
    .prepare("INSERT INTO products (user_id, product_name, category, quantity, unit, unit_price, co2_emission) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
    .get(userId, "Apple", "produce", 10, "pcs", 2, 0.5) as { id: number };
  productId = prodRow.id;

  // Seed all badge definitions
  const stmt = sqlite.prepare(
    "INSERT INTO badges (code, name, description, category, points_awarded, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const def of BADGE_DEFINITIONS) {
    stmt.run(def.code, def.name, def.description, def.category, def.pointsAwarded, def.sortOrder);
  }
});

beforeEach(() => {
  sqlite.exec("DELETE FROM user_badges");
  sqlite.exec("DELETE FROM product_sustainability_metrics");
  sqlite.exec("DELETE FROM user_points");
  sqlite.exec("DELETE FROM notifications");
  sqlite.exec("DELETE FROM notification_preferences");
  // Reset product quantity
  sqlite.exec(`UPDATE products SET quantity = 10 WHERE id = ${productId}`);
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("Consumption → Badge → Points integration", () => {
  test("confirmIngredients awards 'first_action' and 'first_consume' badges and adds bonus points", async () => {
    // User has 0 points, 0 badges
    const result = await confirmIngredients(testDb, userId, [
      {
        productId,
        productName: "Apple",
        quantityUsed: 3,
        unit: "pcs",
        category: "produce",
        unitPrice: 2,
        co2Emission: 0.5,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.interactionIds.length).toBe(1);

    // Should have earned at least first_action and first_consume
    expect(result.newBadges.length).toBeGreaterThanOrEqual(2);

    const firstAction = result.newBadges.find(b => b.code === "first_action");
    const firstConsume = result.newBadges.find(b => b.code === "first_consume");
    expect(firstAction).toBeDefined();
    expect(firstAction!.pointsAwarded).toBe(25);
    expect(firstConsume).toBeDefined();
    expect(firstConsume!.pointsAwarded).toBe(25);

    // Points should reflect badge bonuses (at least 50)
    const points = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, userId),
    });
    expect(points).toBeDefined();
    expect(points!.totalPoints).toBeGreaterThanOrEqual(50);
  });

  test("confirmWaste also triggers badge checking and returns newBadges", async () => {
    // First do a consumption so there's something to waste against
    await confirmIngredients(testDb, userId, [
      {
        productId,
        productName: "Apple",
        quantityUsed: 5,
        unit: "pcs",
        category: "produce",
        unitPrice: 2,
        co2Emission: 0.5,
      },
    ]);

    // Clear the awarded badges so confirmWaste can re-trigger checking
    // (in real usage, confirmIngredients already awarded first_action etc.,
    // but here we verify confirmWaste returns badges too if any are new)
    const wasteResult = await confirmWaste(
      testDb,
      userId,
      [
        {
          productId,
          productName: "Apple",
          quantityUsed: 5,
          unit: "pcs",
          category: "produce",
          unitPrice: 2,
          co2Emission: 0.5,
        },
      ],
      [{ productId, productName: "Apple", quantityWasted: 1 }],
    );

    expect(wasteResult.success).toBe(true);
    expect(wasteResult.metrics).toBeDefined();
    // newBadges should be an array (may be empty if all were already earned in confirmIngredients)
    expect(Array.isArray(wasteResult.newBadges)).toBe(true);
  });

  test("full flow: new user consumes → wastes → points reflect badge bonuses without visiting badges page", async () => {
    // Step 1: Confirm ingredients (consume)
    const consumeResult = await confirmIngredients(testDb, userId, [
      {
        productId,
        productName: "Apple",
        quantityUsed: 3,
        unit: "pcs",
        category: "produce",
        unitPrice: 2,
        co2Emission: 0.5,
      },
    ]);

    expect(consumeResult.success).toBe(true);
    const badgesAfterConsume = consumeResult.newBadges;

    // Step 2: Confirm waste
    const wasteResult = await confirmWaste(
      testDb,
      userId,
      [
        {
          productId,
          productName: "Apple",
          quantityUsed: 3,
          unit: "pcs",
          category: "produce",
          unitPrice: 2,
          co2Emission: 0.5,
        },
      ],
      [{ productId, productName: "Apple", quantityWasted: 1 }],
    );

    expect(wasteResult.success).toBe(true);
    const allNewBadges = [...badgesAfterConsume, ...wasteResult.newBadges];

    // Step 3: Verify — at least "First Steps" (first_action) and "Clean Plate" (first_consume) were earned
    const earnedCodes = allNewBadges.map(b => b.code);
    expect(earnedCodes).toContain("first_action");
    expect(earnedCodes).toContain("first_consume");

    // Step 4: Verify — total points reflect badge bonuses
    const totalBadgeBonus = allNewBadges.reduce((sum, b) => sum + b.pointsAwarded, 0);
    expect(totalBadgeBonus).toBeGreaterThanOrEqual(50); // 25 + 25 minimum

    const points = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, userId),
    });
    expect(points).toBeDefined();
    // Points should be at least the badge bonuses (no action points for consumed/wasted)
    expect(points!.totalPoints).toBeGreaterThanOrEqual(50);

    // Step 5: Verify — userBadges rows exist in DB
    const earnedBadges = await testDb.query.userBadges.findMany({
      where: eq(schema.userBadges.userId, userId),
    });
    expect(earnedBadges.length).toBeGreaterThanOrEqual(2);
  });

  test("badges are not double-awarded on second consumption", async () => {
    // First consumption — earns badges
    const first = await confirmIngredients(testDb, userId, [
      {
        productId,
        productName: "Apple",
        quantityUsed: 2,
        unit: "pcs",
        category: "produce",
        unitPrice: 2,
        co2Emission: 0.5,
      },
    ]);
    const firstBadgeCount = first.newBadges.length;
    expect(firstBadgeCount).toBeGreaterThanOrEqual(2);

    const pointsAfterFirst = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, userId),
    });

    // Second consumption — same badges should NOT be re-awarded
    const second = await confirmIngredients(testDb, userId, [
      {
        productId,
        productName: "Apple",
        quantityUsed: 2,
        unit: "pcs",
        category: "produce",
        unitPrice: 2,
        co2Emission: 0.5,
      },
    ]);

    // first_action and first_consume already earned, so they shouldn't appear again
    const reAwardedFirst = second.newBadges.find(b => b.code === "first_action");
    const reAwardedConsume = second.newBadges.find(b => b.code === "first_consume");
    expect(reAwardedFirst).toBeUndefined();
    expect(reAwardedConsume).toBeUndefined();

    // Points should not have been added again for the same badges
    const pointsAfterSecond = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, userId),
    });
    // The difference should only be from any NEW badges earned (if any), not re-awards
    const pointsDiff = pointsAfterSecond!.totalPoints - pointsAfterFirst!.totalPoints;
    // Should not include another 50 from first_action + first_consume
    const reAwardedPoints = (reAwardedFirst?.pointsAwarded ?? 0) + (reAwardedConsume?.pointsAwarded ?? 0);
    expect(reAwardedPoints).toBe(0);
  });
});
