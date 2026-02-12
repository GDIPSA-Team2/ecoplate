import { describe, expect, test, mock, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router } from "../../utils/router";
import * as schema from "../../db/schema";

// Mock auth middleware with all exports
let testUserId = 1;
mock.module("../../middleware/auth", () => ({
  hashPassword: async (password: string): Promise<string> => `hashed_${password}`,
  verifyPassword: async (password: string, hash: string): Promise<boolean> =>
    hash === `hashed_${password}`,
  generateToken: async (payload: { sub: string; email: string; name: string }): Promise<string> =>
    `token_${payload.sub}_${payload.email}`,
  verifyToken: async (token: string): Promise<{ sub: string; email: string; name: string } | null> => {
    const match = token.match(/^token_(\d+)_(.+)$/);
    if (!match) return null;
    return { sub: match[1], email: match[2], name: "Test User" };
  },
  getUser: () => ({
    id: testUserId,
    email: "test@example.com",
    name: "Test User",
  }),
  extractBearerToken: (req: Request): string | null => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return authHeader.slice(7);
  },
  authMiddleware: async (_req: Request, next: () => Promise<Response>) => next(),
  verifyRequestAuth: async (req: Request) => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const match = token.match(/^token_(\d+)_(.+)$/);
    if (!match) return null;
    return { sub: match[1], email: match[2], name: "Test User" };
  },
}));

// Set up in-memory test database with full schema
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Create tables matching actual schema
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
      expiry_date INTEGER,
      description TEXT,
      image_url TEXT,
      co2_emission REAL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE product_sustainability_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      quantity REAL,
      unit TEXT,
      type TEXT,
      today_date TEXT NOT NULL
    );

    CREATE TABLE user_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      total_points INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      total_co2_saved REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE marketplace_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_id INTEGER REFERENCES users(id),
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT,
      price REAL,
      original_price REAL,
      expiry_date INTEGER,
      pickup_location TEXT,
      images TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER,
      co2_saved REAL
    );
  `);

  testDb = drizzle(sqlite, { schema });

  // Inject test database
  const { __setTestDb } = await import("../../db/connection");
  __setTestDb(testDb as any);

  // Seed test user
  await testDb.insert(schema.users).values({
    email: "test@example.com",
    passwordHash: "hashed",
    name: "Test User",
  });
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  await testDb.delete(schema.productSustainabilityMetrics);
  await testDb.delete(schema.marketplaceListings);
  await testDb.delete(schema.products);
});

// Import routes after db setup
let registerDashboardRoutes: (router: Router) => void;
beforeAll(async () => {
  const dashboardModule = await import("../dashboard");
  registerDashboardRoutes = dashboardModule.registerDashboardRoutes;
});

function createRouter() {
  const router = new Router();
  registerDashboardRoutes(router);
  return router;
}

async function makeRequest(
  router: Router,
  method: string,
  path: string
): Promise<{ status: number; data: unknown }> {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });

  const response = await router.handle(req);
  if (!response) {
    return { status: 404, data: { error: "Not found" } };
  }
  const data = await response.json();
  return { status: response.status, data };
}

describe("GET /api/v1/dashboard/stats", () => {
  test("returns 200 with default period", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
  });

  test("returns 200 with period=day", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/stats?period=day");
    expect(res.status).toBe(200);
  });

  test("returns 200 with period=month", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/stats?period=month");
    expect(res.status).toBe(200);
  });

  test("returns 200 with period=annual", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/stats?period=annual");
    expect(res.status).toBe(200);
  });

  test("handles invalid period gracefully", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/stats?period=invalid");
    expect(res.status).toBe(200); // Should default to month
  });
});

describe("GET /api/v1/dashboard/co2", () => {
  test("returns 200 with default period", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/co2");
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
  });

  test("returns 200 with period=annual", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/co2?period=annual");
    expect(res.status).toBe(200);
  });

  test("returns 200 with period=day", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/co2?period=day");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/dashboard/financial", () => {
  test("returns 200 with default period", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/financial");
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
  });

  test("returns 200 with period=day", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/financial?period=day");
    expect(res.status).toBe(200);
  });

  test("returns 200 with period=annual", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/financial?period=annual");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/dashboard/food", () => {
  test("returns 200 with default period", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/food");
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
  });

  test("returns 200 with period=month", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/food?period=month");
    expect(res.status).toBe(200);
  });

  test("returns 200 with period=annual", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/dashboard/food?period=annual");
    expect(res.status).toBe(200);
  });
});
