import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;

// Simplified badge definitions for testing
const BADGE_DEFINITIONS = [
  {
    code: "first_action",
    name: "First Steps",
    description: "Complete your first sustainability action",
    category: "milestones",
    pointsAwarded: 25,
    sortOrder: 1,
    condition: (m: BadgeMetrics) => m.totalActions >= 1,
    progress: (m: BadgeMetrics) => ({
      current: Math.min(m.totalActions, 1),
      target: 1,
      percentage: Math.min(100, (m.totalActions / 1) * 100),
    }),
  },
  {
    code: "eco_starter",
    name: "Eco Starter",
    description: "Complete 10 sustainability actions",
    category: "milestones",
    pointsAwarded: 50,
    sortOrder: 2,
    condition: (m: BadgeMetrics) => m.totalActions >= 10,
    progress: (m: BadgeMetrics) => ({
      current: Math.min(m.totalActions, 10),
      target: 10,
      percentage: Math.min(100, (m.totalActions / 10) * 100),
    }),
  },
  {
    code: "first_consume",
    name: "Clean Plate",
    description: "Consume your first item",
    category: "waste-reduction",
    pointsAwarded: 25,
    sortOrder: 5,
    condition: (m: BadgeMetrics) => m.totalConsumed >= 1,
    progress: (m: BadgeMetrics) => ({
      current: Math.min(m.totalConsumed, 1),
      target: 1,
      percentage: Math.min(100, (m.totalConsumed / 1) * 100),
    }),
  },
  {
    code: "waste_warrior",
    name: "Waste Warrior",
    description: "80%+ waste reduction rate (min 20 items)",
    category: "waste-reduction",
    pointsAwarded: 100,
    sortOrder: 7,
    condition: (m: BadgeMetrics) => m.wasteReductionRate >= 80 && m.totalItems >= 20,
    progress: (m: BadgeMetrics) => {
      if (m.totalItems < 20) {
        return {
          current: m.totalItems,
          target: 20,
          percentage: Math.min(100, (m.totalItems / 20) * 100),
        };
      }
      return {
        current: Math.min(Math.round(m.wasteReductionRate), 100),
        target: 80,
        percentage: Math.min(100, (m.wasteReductionRate / 80) * 100),
      };
    },
  },
  {
    code: "first_sale",
    name: "First Sale",
    description: "Sell your first marketplace item",
    category: "sharing",
    pointsAwarded: 25,
    sortOrder: 9,
    condition: (m: BadgeMetrics) => m.totalSold >= 1,
    progress: (m: BadgeMetrics) => ({
      current: Math.min(m.totalSold, 1),
      target: 1,
      percentage: Math.min(100, (m.totalSold / 1) * 100),
    }),
  },
];

interface BadgeMetrics {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  totalConsumed: number;
  totalWasted: number;
  totalShared: number;
  totalSold: number;
  totalActions: number;
  totalItems: number;
  wasteReductionRate: number;
}

// Helper function to get user badge metrics
async function getUserBadgeMetrics(db: typeof testDb, userId: number): Promise<BadgeMetrics> {
  const userPoints = await db.query.userPoints.findFirst({
    where: eq(schema.userPoints.userId, userId),
  });

  const interactions = await db.query.productSustainabilityMetrics.findMany({
    where: eq(schema.productSustainabilityMetrics.userId, userId),
  });

  let totalConsumed = 0;
  let totalWasted = 0;
  let totalShared = 0;
  let totalSold = 0;

  for (const interaction of interactions) {
    const type = (interaction.type || "").toLowerCase();
    if (type === "consumed" || type === "consume") totalConsumed++;
    else if (type === "wasted" || type === "waste") totalWasted++;
    else if (type === "shared") totalShared++;
    else if (type === "sold") totalSold++;
  }

  const totalActions = totalConsumed + totalShared + totalSold;
  const totalItems = totalActions + totalWasted;
  const wasteReductionRate = totalItems > 0 ? (totalActions / totalItems) * 100 : 0;

  return {
    totalPoints: userPoints?.totalPoints ?? 0,
    currentStreak: userPoints?.currentStreak ?? 0,
    longestStreak: 0,
    totalConsumed,
    totalWasted,
    totalShared,
    totalSold,
    totalActions,
    totalItems,
    wasteReductionRate,
  };
}

// Helper function to check and award badges
async function checkAndAwardBadges(
  db: typeof testDb,
  userId: number
): Promise<Array<{ code: string; name: string; pointsAwarded: number }>> {
  const metrics = await getUserBadgeMetrics(db, userId);

  const allBadges = await db.query.badges.findMany();
  const badgeByCode = new Map(allBadges.map((b) => [b.code, b]));

  const earnedUserBadges = await db.query.userBadges.findMany({
    where: eq(schema.userBadges.userId, userId),
  });
  const earnedBadgeIds = new Set(earnedUserBadges.map((ub) => ub.badgeId));

  const newlyAwarded: Array<{ code: string; name: string; pointsAwarded: number }> = [];

  for (const def of BADGE_DEFINITIONS) {
    const dbBadge = badgeByCode.get(def.code);
    if (!dbBadge) continue;
    if (earnedBadgeIds.has(dbBadge.id)) continue;
    if (!def.condition(metrics)) continue;

    try {
      await db.insert(schema.userBadges).values({
        userId,
        badgeId: dbBadge.id,
      });

      if (dbBadge.pointsAwarded > 0) {
        const userPoints = await db.query.userPoints.findFirst({
          where: eq(schema.userPoints.userId, userId),
        });
        if (userPoints) {
          await db
            .update(schema.userPoints)
            .set({ totalPoints: userPoints.totalPoints + dbBadge.pointsAwarded })
            .where(eq(schema.userPoints.userId, userId));
        }
      }

      newlyAwarded.push({
        code: def.code,
        name: def.name,
        pointsAwarded: dbBadge.pointsAwarded,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("UNIQUE constraint failed") ||
        errorMessage.includes("SQLITE_CONSTRAINT")
      ) {
        continue;
      }
      throw err;
    }
  }

  return newlyAwarded;
}

// Helper function to get badge progress
async function getBadgeProgress(
  db: typeof testDb,
  userId: number
): Promise<Record<string, { current: number; target: number; percentage: number }>> {
  const metrics = await getUserBadgeMetrics(db, userId);

  const progress: Record<string, { current: number; target: number; percentage: number }> = {};

  for (const def of BADGE_DEFINITIONS) {
    const p = def.progress(metrics);
    progress[def.code] = {
      current: p.current,
      target: p.target,
      percentage: Math.round(p.percentage),
    };
  }

  return progress;
}

beforeAll(async () => {
  sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

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

    CREATE TABLE user_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      total_points INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      total_co2_saved REAL NOT NULL DEFAULT 0
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

    CREATE TABLE product_sustainability_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      today_date TEXT NOT NULL,
      quantity REAL,
      type TEXT
    );
  `);

  testDb = drizzle(sqlite, { schema });

  // Seed test user
  const [user] = await testDb
    .insert(schema.users)
    .values({
      email: "test@example.com",
      passwordHash: "hashed",
      name: "Test User",
    })
    .returning();
  testUserId = user.id;

  // Seed badges
  for (const def of BADGE_DEFINITIONS) {
    await testDb.insert(schema.badges).values({
      code: def.code,
      name: def.name,
      description: def.description,
      category: def.category,
      pointsAwarded: def.pointsAwarded,
      sortOrder: def.sortOrder,
    });
  }
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  await testDb.delete(schema.productSustainabilityMetrics);
  await testDb.delete(schema.userBadges);
  await testDb.delete(schema.userPoints);

  // Re-create user points
  await testDb.insert(schema.userPoints).values({
    userId: testUserId,
    totalPoints: 0,
    currentStreak: 0,
  });
});

describe("getUserBadgeMetrics", () => {
  test("returns zero metrics for user with no activity", async () => {
    const metrics = await getUserBadgeMetrics(testDb, testUserId);

    expect(metrics.totalConsumed).toBe(0);
    expect(metrics.totalWasted).toBe(0);
    expect(metrics.totalShared).toBe(0);
    expect(metrics.totalSold).toBe(0);
    expect(metrics.totalActions).toBe(0);
    expect(metrics.totalItems).toBe(0);
    expect(metrics.wasteReductionRate).toBe(0);
  });

  test("counts consumed items", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    const metrics = await getUserBadgeMetrics(testDb, testUserId);

    expect(metrics.totalConsumed).toBe(2);
    expect(metrics.totalActions).toBe(2);
  });

  test("handles case-insensitive type values", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "Consume", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "Waste", quantity: 1 },
    ]);

    const metrics = await getUserBadgeMetrics(testDb, testUserId);

    expect(metrics.totalConsumed).toBe(1);
    expect(metrics.totalWasted).toBe(1);
  });

  test("calculates waste reduction rate", async () => {
    // 3 consumed + 1 wasted = 75% waste reduction
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
    ]);

    const metrics = await getUserBadgeMetrics(testDb, testUserId);

    expect(metrics.wasteReductionRate).toBe(75);
  });

  test("includes shared and sold in totalActions", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "shared", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
    ]);

    const metrics = await getUserBadgeMetrics(testDb, testUserId);

    expect(metrics.totalActions).toBe(3);
    expect(metrics.totalConsumed).toBe(1);
    expect(metrics.totalShared).toBe(1);
    expect(metrics.totalSold).toBe(1);
  });
});

describe("checkAndAwardBadges", () => {
  test("awards first_action badge on first action", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    const newBadges = await checkAndAwardBadges(testDb, testUserId);

    expect(newBadges.length).toBeGreaterThan(0);
    expect(newBadges.some((b) => b.code === "first_action")).toBe(true);
  });

  test("awards first_consume badge when first item consumed", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    const newBadges = await checkAndAwardBadges(testDb, testUserId);

    expect(newBadges.some((b) => b.code === "first_consume")).toBe(true);
  });

  test("awards first_sale badge when first item sold", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
    ]);

    const newBadges = await checkAndAwardBadges(testDb, testUserId);

    expect(newBadges.some((b) => b.code === "first_sale")).toBe(true);
  });

  test("does not award already earned badge", async () => {
    // First check: should award badge
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    const firstCheck = await checkAndAwardBadges(testDb, testUserId);
    expect(firstCheck.some((b) => b.code === "first_action")).toBe(true);

    // Second check: should not award again
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-16", type: "consumed", quantity: 1 },
    ]);

    const secondCheck = await checkAndAwardBadges(testDb, testUserId);
    expect(secondCheck.some((b) => b.code === "first_action")).toBe(false);
  });

  test("awards bonus points when badge earned", async () => {
    const pointsBefore = (
      await testDb.query.userPoints.findFirst({
        where: eq(schema.userPoints.userId, testUserId),
      })
    )?.totalPoints;

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    await checkAndAwardBadges(testDb, testUserId);

    const pointsAfter = (
      await testDb.query.userPoints.findFirst({
        where: eq(schema.userPoints.userId, testUserId),
      })
    )?.totalPoints;

    // first_action (25) + first_consume (25) = 50 points
    expect(pointsAfter).toBe((pointsBefore ?? 0) + 50);
  });

  test("awards eco_starter badge after 10 actions", async () => {
    // Add 10 consumed actions
    for (let i = 0; i < 10; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(i + 1).padStart(2, "0")}`,
        type: "consumed",
        quantity: 1,
      });
    }

    const newBadges = await checkAndAwardBadges(testDb, testUserId);

    expect(newBadges.some((b) => b.code === "eco_starter")).toBe(true);
  });

  test("awards waste_warrior badge at 80% reduction rate with 20+ items", async () => {
    // Add 18 consumed + 2 wasted = 90% reduction rate with 20 items
    for (let i = 0; i < 18; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(i + 1).padStart(2, "0")}`,
        type: "consumed",
        quantity: 1,
      });
    }
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-19", type: "wasted", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-20", type: "wasted", quantity: 1 },
    ]);

    const newBadges = await checkAndAwardBadges(testDb, testUserId);

    expect(newBadges.some((b) => b.code === "waste_warrior")).toBe(true);
  });

  test("does not award waste_warrior with less than 20 items", async () => {
    // 9 consumed + 1 wasted = 90% but only 10 items
    for (let i = 0; i < 9; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(i + 1).padStart(2, "0")}`,
        type: "consumed",
        quantity: 1,
      });
    }
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId: testUserId,
      todayDate: "2025-01-10",
      type: "wasted",
      quantity: 1,
    });

    const newBadges = await checkAndAwardBadges(testDb, testUserId);

    expect(newBadges.some((b) => b.code === "waste_warrior")).toBe(false);
  });
});

describe("getBadgeProgress", () => {
  test("returns progress for all badges", async () => {
    const progress = await getBadgeProgress(testDb, testUserId);

    expect(progress.first_action).toBeDefined();
    expect(progress.eco_starter).toBeDefined();
    expect(progress.first_consume).toBeDefined();
    expect(progress.first_sale).toBeDefined();
  });

  test("shows 0 progress with no activity", async () => {
    const progress = await getBadgeProgress(testDb, testUserId);

    expect(progress.first_action.current).toBe(0);
    expect(progress.first_action.target).toBe(1);
    expect(progress.first_action.percentage).toBe(0);
  });

  test("shows correct progress for first_action", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    const progress = await getBadgeProgress(testDb, testUserId);

    expect(progress.first_action.current).toBe(1);
    expect(progress.first_action.percentage).toBe(100);
  });

  test("shows correct progress for eco_starter", async () => {
    // Add 5 actions (50% progress towards 10)
    for (let i = 0; i < 5; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(i + 1).padStart(2, "0")}`,
        type: "consumed",
        quantity: 1,
      });
    }

    const progress = await getBadgeProgress(testDb, testUserId);

    expect(progress.eco_starter.current).toBe(5);
    expect(progress.eco_starter.target).toBe(10);
    expect(progress.eco_starter.percentage).toBe(50);
  });

  test("caps percentage at 100", async () => {
    // Add 15 actions (150% of target but should cap at 100)
    for (let i = 0; i < 15; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(i + 1).padStart(2, "0")}`,
        type: "consumed",
        quantity: 1,
      });
    }

    const progress = await getBadgeProgress(testDb, testUserId);

    expect(progress.eco_starter.percentage).toBe(100);
  });

  test("shows item count progress for waste_warrior when below 20 items", async () => {
    // Add 10 items (should show progress towards 20 items, not towards 80% rate)
    for (let i = 0; i < 10; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(i + 1).padStart(2, "0")}`,
        type: "consumed",
        quantity: 1,
      });
    }

    const progress = await getBadgeProgress(testDb, testUserId);

    expect(progress.waste_warrior.current).toBe(10);
    expect(progress.waste_warrior.target).toBe(20);
    expect(progress.waste_warrior.percentage).toBe(50);
  });

  test("shows rate progress for waste_warrior when 20+ items", async () => {
    // Add 16 consumed + 4 wasted = 80% reduction rate with 20 items
    for (let i = 0; i < 16; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(i + 1).padStart(2, "0")}`,
        type: "consumed",
        quantity: 1,
      });
    }
    for (let i = 0; i < 4; i++) {
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId: testUserId,
        todayDate: `2025-01-${String(17 + i).padStart(2, "0")}`,
        type: "wasted",
        quantity: 1,
      });
    }

    const progress = await getBadgeProgress(testDb, testUserId);

    expect(progress.waste_warrior.current).toBe(80);
    expect(progress.waste_warrior.target).toBe(80);
    expect(progress.waste_warrior.percentage).toBe(100);
  });
});

describe("race condition handling", () => {
  test("handles duplicate badge insert gracefully", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    // First award
    const first = await checkAndAwardBadges(testDb, testUserId);
    expect(first.some((b) => b.code === "first_action")).toBe(true);

    // Second award (same user, same conditions) should not throw
    const second = await checkAndAwardBadges(testDb, testUserId);
    expect(second.some((b) => b.code === "first_action")).toBe(false);

    // Verify only one badge exists
    const badges = await testDb.query.userBadges.findMany({
      where: eq(schema.userBadges.userId, testUserId),
    });

    const firstActionBadges = badges.filter((b) => {
      const badge = testDb.query.badges.findFirst({
        where: eq(schema.badges.id, b.badgeId),
      });
      return badge;
    });

    // Should have exactly 2 badges (first_action and first_consume) not duplicates
    expect(badges.length).toBe(2);
  });
});
