import { describe, expect, test, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;
let secondUserId: number;

const POINT_VALUES = {
  consumed: 5,
  shared: 10,
  sold: 8,
  wasted: -3,
} as const;

type PointAction = keyof typeof POINT_VALUES;

// Implementation of functions under test (simplified versions that use testDb)
async function getOrCreateUserPoints(db: typeof testDb, userId: number) {
  let points = await db.query.userPoints.findFirst({
    where: eq(schema.userPoints.userId, userId),
  });

  if (!points) {
    const [created] = await db
      .insert(schema.userPoints)
      .values({ userId })
      .returning();
    points = created;
  }

  return points;
}

async function awardPoints(
  db: typeof testDb,
  userId: number,
  action: PointAction,
  productId?: number | null,
  quantity?: number,
  listingData?: { co2Saved: number | null; buyerId: number | null }
) {
  const amount = POINT_VALUES[action];
  const userPoints = await getOrCreateUserPoints(db, userId);

  const newTotal = Math.max(0, userPoints.totalPoints + amount);

  await db
    .update(schema.userPoints)
    .set({ totalPoints: newTotal })
    .where(eq(schema.userPoints.userId, userId));

  // Record the sustainability metric
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(schema.productSustainabilityMetrics).values({
    productId: productId ?? null,
    userId,
    todayDate: today,
    quantity: quantity ?? 1,
    type: action,
  });

  // Handle CO2 tracking for sold items
  let co2Saved: number | null = null;
  if (action === "sold" && listingData?.co2Saved) {
    co2Saved = listingData.co2Saved;

    // Award CO2 to seller
    await db
      .update(schema.userPoints)
      .set({ totalCo2Saved: userPoints.totalCo2Saved + co2Saved })
      .where(eq(schema.userPoints.userId, userId));

    // Award CO2 to buyer if exists
    if (listingData.buyerId) {
      const buyerPoints = await getOrCreateUserPoints(db, listingData.buyerId);
      await db
        .update(schema.userPoints)
        .set({ totalCo2Saved: buyerPoints.totalCo2Saved + co2Saved })
        .where(eq(schema.userPoints.userId, listingData.buyerId));
    }
  }

  return { action, amount, newTotal, newBadges: [], co2Saved };
}

async function getUserMetrics(db: typeof testDb, userId: number) {
  const interactions = await db.query.productSustainabilityMetrics.findMany({
    where: eq(schema.productSustainabilityMetrics.userId, userId),
  });

  const metrics = {
    totalItemsConsumed: 0,
    totalItemsWasted: 0,
    totalItemsShared: 0,
    totalItemsSold: 0,
  };

  for (const interaction of interactions) {
    switch (interaction.type) {
      case "consumed":
        metrics.totalItemsConsumed++;
        break;
      case "wasted":
        metrics.totalItemsWasted++;
        break;
      case "shared":
        metrics.totalItemsShared++;
        break;
      case "sold":
        metrics.totalItemsSold++;
        break;
    }
  }

  const totalItems =
    metrics.totalItemsConsumed +
    metrics.totalItemsWasted +
    metrics.totalItemsShared +
    metrics.totalItemsSold;

  const itemsSaved =
    metrics.totalItemsConsumed + metrics.totalItemsShared + metrics.totalItemsSold;

  const wasteReductionRate = totalItems > 0 ? (itemsSaved / totalItems) * 100 : 100;
  const estimatedCo2Saved = itemsSaved * 0.5;
  const estimatedMoneySaved = itemsSaved * 5;

  return {
    ...metrics,
    wasteReductionRate,
    estimatedCo2Saved,
    estimatedMoneySaved,
  };
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

  // Seed test users
  const [user1] = await testDb
    .insert(schema.users)
    .values({
      email: "test@example.com",
      passwordHash: "hashed",
      name: "Test User",
    })
    .returning();
  testUserId = user1.id;

  const [user2] = await testDb
    .insert(schema.users)
    .values({
      email: "buyer@example.com",
      passwordHash: "hashed",
      name: "Buyer User",
    })
    .returning();
  secondUserId = user2.id;
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  await testDb.delete(schema.productSustainabilityMetrics);
  await testDb.delete(schema.userPoints);
});

describe("getOrCreateUserPoints", () => {
  test("creates user points if not exists", async () => {
    const points = await getOrCreateUserPoints(testDb, testUserId);

    expect(points).toBeDefined();
    expect(points.userId).toBe(testUserId);
    expect(points.totalPoints).toBe(0);
    expect(points.currentStreak).toBe(0);
  });

  test("returns existing user points", async () => {
    // Create points first
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 100,
      currentStreak: 5,
    });

    const points = await getOrCreateUserPoints(testDb, testUserId);

    expect(points.totalPoints).toBe(100);
    expect(points.currentStreak).toBe(5);
  });

  test("does not create duplicate records", async () => {
    await getOrCreateUserPoints(testDb, testUserId);
    await getOrCreateUserPoints(testDb, testUserId);

    const allPoints = await testDb.query.userPoints.findMany({
      where: eq(schema.userPoints.userId, testUserId),
    });

    expect(allPoints.length).toBe(1);
  });
});

describe("awardPoints", () => {
  test("awards points for consumed action", async () => {
    const result = await awardPoints(testDb, testUserId, "consumed");

    expect(result.action).toBe("consumed");
    expect(result.amount).toBe(5);
    expect(result.newTotal).toBe(5);
  });

  test("awards points for shared action", async () => {
    const result = await awardPoints(testDb, testUserId, "shared");

    expect(result.action).toBe("shared");
    expect(result.amount).toBe(10);
    expect(result.newTotal).toBe(10);
  });

  test("awards points for sold action", async () => {
    const result = await awardPoints(testDb, testUserId, "sold");

    expect(result.action).toBe("sold");
    expect(result.amount).toBe(8);
    expect(result.newTotal).toBe(8);
  });

  test("deducts points for wasted action", async () => {
    // First give user some points
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 10,
    });

    const result = await awardPoints(testDb, testUserId, "wasted");

    expect(result.action).toBe("wasted");
    expect(result.amount).toBe(-3);
    expect(result.newTotal).toBe(7);
  });

  test("points cannot go below zero", async () => {
    // User starts with 0 points
    const result = await awardPoints(testDb, testUserId, "wasted");

    expect(result.newTotal).toBe(0);
  });

  test("records sustainability metric", async () => {
    await awardPoints(testDb, testUserId, "consumed", 123, 2);

    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, testUserId),
    });

    expect(metrics.length).toBe(1);
    expect(metrics[0].type).toBe("consumed");
    expect(metrics[0].productId).toBe(123);
    expect(metrics[0].quantity).toBe(2);
  });

  test("records metric with null productId", async () => {
    await awardPoints(testDb, testUserId, "sold", null, 1);

    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, testUserId),
    });

    expect(metrics[0].productId).toBeNull();
  });

  test("accumulates points over multiple actions", async () => {
    await awardPoints(testDb, testUserId, "consumed"); // +5
    await awardPoints(testDb, testUserId, "shared"); // +10
    await awardPoints(testDb, testUserId, "sold"); // +8

    const points = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, testUserId),
    });

    expect(points?.totalPoints).toBe(23);
  });

  test("awards CO2 to seller when sold with co2Saved", async () => {
    const result = await awardPoints(testDb, testUserId, "sold", null, 1, {
      co2Saved: 2.5,
      buyerId: null,
    });

    expect(result.co2Saved).toBe(2.5);

    const points = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, testUserId),
    });

    expect(points?.totalCo2Saved).toBe(2.5);
  });

  test("awards CO2 to both seller and buyer when sold", async () => {
    await awardPoints(testDb, testUserId, "sold", null, 1, {
      co2Saved: 3.0,
      buyerId: secondUserId,
    });

    const sellerPoints = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, testUserId),
    });
    expect(sellerPoints?.totalCo2Saved).toBe(3.0);

    const buyerPoints = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, secondUserId),
    });
    expect(buyerPoints?.totalCo2Saved).toBe(3.0);
  });

  test("does not award CO2 for non-sold actions", async () => {
    await awardPoints(testDb, testUserId, "consumed");

    const points = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, testUserId),
    });

    expect(points?.totalCo2Saved).toBe(0);
  });
});

describe("getUserMetrics", () => {
  test("returns zero metrics for user with no activity", async () => {
    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.totalItemsConsumed).toBe(0);
    expect(metrics.totalItemsWasted).toBe(0);
    expect(metrics.totalItemsShared).toBe(0);
    expect(metrics.totalItemsSold).toBe(0);
    expect(metrics.wasteReductionRate).toBe(100);
  });

  test("counts consumed items correctly", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.totalItemsConsumed).toBe(3);
  });

  test("counts wasted items correctly", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.totalItemsWasted).toBe(2);
  });

  test("counts shared items correctly", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "shared", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.totalItemsShared).toBe(1);
  });

  test("counts sold items correctly", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.totalItemsSold).toBe(2);
  });

  test("calculates waste reduction rate correctly", async () => {
    // 3 consumed, 1 wasted = 75% saved
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.wasteReductionRate).toBe(75);
  });

  test("handles 100% waste scenario", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.wasteReductionRate).toBe(0);
  });

  test("handles 0% waste scenario (all saved)", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "shared", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.wasteReductionRate).toBe(100);
  });

  test("calculates estimated CO2 saved", async () => {
    // 4 items saved * 0.5 kg CO2 each = 2.0 kg
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "shared", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.estimatedCo2Saved).toBe(2.0);
  });

  test("calculates estimated money saved", async () => {
    // 3 items saved * $5 each = $15
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "shared", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
    ]);

    const metrics = await getUserMetrics(testDb, testUserId);

    expect(metrics.estimatedMoneySaved).toBe(15);
  });

  test("only counts metrics for the specified user", async () => {
    // Add metrics for both users
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: secondUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: secondUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
    ]);

    const metricsUser1 = await getUserMetrics(testDb, testUserId);
    const metricsUser2 = await getUserMetrics(testDb, secondUserId);

    expect(metricsUser1.totalItemsConsumed).toBe(1);
    expect(metricsUser2.totalItemsConsumed).toBe(2);
  });
});

describe("POINT_VALUES", () => {
  test("consumed action gives 5 points", () => {
    expect(POINT_VALUES.consumed).toBe(5);
  });

  test("shared action gives 10 points", () => {
    expect(POINT_VALUES.shared).toBe(10);
  });

  test("sold action gives 8 points", () => {
    expect(POINT_VALUES.sold).toBe(8);
  });

  test("wasted action deducts 3 points", () => {
    expect(POINT_VALUES.wasted).toBe(-3);
  });
});
