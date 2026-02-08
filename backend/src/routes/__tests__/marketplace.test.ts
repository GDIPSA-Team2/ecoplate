import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;
let otherUserId: number;

const listingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  quantity: z.number().positive().max(10000).default(1),
  unit: z.string().max(20).default("item"),
  price: z.number().min(0).max(1000000).nullable().optional(),
  originalPrice: z.number().positive().max(1000000).optional(),
  expiryDate: z.string().max(50).optional(),
  pickupLocation: z.string().max(500).optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  pickupInstructions: z.string().max(1000).optional(),
  imageUrls: z.array(
    z.string().max(500).regex(/^(?!.*\.\.)[\w\-\.\/]+$/, "Invalid image URL format")
  ).max(5).optional(),
});

function registerTestMarketplaceRoutes(
  router: Router,
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: number
) {
  router.use(async (req, next) => {
    (req as Request & { user: { id: number; email: string; name: string } }).user = {
      id: userId,
      email: "test@example.com",
      name: "Test User",
    };
    return next();
  });

  const getUser = (req: Request) =>
    (req as Request & { user: { id: number; email: string; name: string } }).user;

  // Create listing
  router.post("/api/v1/marketplace/listings", async (req) => {
    try {
      const user = getUser(req);
      const body = await req.json();
      const data = listingSchema.parse(body);

      let pickupLocationValue = data.pickupLocation;
      if (data.coordinates && data.pickupLocation) {
        pickupLocationValue = `${data.pickupLocation}|${data.coordinates.latitude},${data.coordinates.longitude}`;
      }

      const [listing] = await db
        .insert(schema.marketplaceListings)
        .values({
          sellerId: user.id,
          title: data.title,
          description: data.description,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          price: data.price,
          originalPrice: data.originalPrice,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          pickupLocation: pickupLocationValue,
          images: data.imageUrls ? JSON.stringify(data.imageUrls) : null,
        })
        .returning();

      return json(listing);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Create listing error:", e);
      return error("Failed to create listing", 500);
    }
  });

  // Get single listing
  router.get("/api/v1/marketplace/listings/:id", async (req, params) => {
    const listingId = parseInt(params.id, 10);

    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(schema.marketplaceListings.id, listingId),
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    return json(listing);
  });

  // Update listing
  router.patch("/api/v1/marketplace/listings/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const listingId = parseInt(params.id, 10);
      const body = await req.json();
      const data = listingSchema.partial().parse(body);

      const existing = await db.query.marketplaceListings.findFirst({
        where: and(
          eq(schema.marketplaceListings.id, listingId),
          eq(schema.marketplaceListings.sellerId, user.id)
        ),
      });

      if (!existing) {
        return error("Listing not found", 404);
      }

      let pickupLocationValue = data.pickupLocation;
      if (data.coordinates && data.pickupLocation) {
        pickupLocationValue = `${data.pickupLocation}|${data.coordinates.latitude},${data.coordinates.longitude}`;
      }

      const [updated] = await db
        .update(schema.marketplaceListings)
        .set({
          title: data.title,
          description: data.description,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          price: data.price,
          originalPrice: data.originalPrice,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : existing.expiryDate,
          pickupLocation: pickupLocationValue ?? existing.pickupLocation,
          images: data.imageUrls ? JSON.stringify(data.imageUrls) : existing.images,
        })
        .where(eq(schema.marketplaceListings.id, listingId))
        .returning();

      return json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Update listing error:", e);
      return error("Failed to update listing", 500);
    }
  });

  // Delete listing
  router.delete("/api/v1/marketplace/listings/:id", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);

    const existing = await db.query.marketplaceListings.findFirst({
      where: and(
        eq(schema.marketplaceListings.id, listingId),
        eq(schema.marketplaceListings.sellerId, user.id)
      ),
    });

    if (!existing) {
      return error("Listing not found", 404);
    }

    await db.delete(schema.marketplaceListings).where(eq(schema.marketplaceListings.id, listingId));

    return json({ message: "Listing deleted" });
  });
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

    CREATE TABLE marketplace_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_id INTEGER REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity REAL NOT NULL,
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

  // Seed test users
  const [user] = await testDb
    .insert(schema.users)
    .values({
      email: "test@example.com",
      passwordHash: "hashed",
      name: "Test User",
    })
    .returning();
  testUserId = user.id;

  const [other] = await testDb
    .insert(schema.users)
    .values({
      email: "other@example.com",
      passwordHash: "hashed",
      name: "Other User",
    })
    .returning();
  otherUserId = other.id;
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  await testDb.delete(schema.marketplaceListings);
});

function createRouter(userId?: number) {
  const router = new Router();
  registerTestMarketplaceRoutes(router, testDb, userId ?? testUserId);
  return router;
}

async function makeRequest(
  router: Router,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const response = await router.handle(req);
  if (!response) {
    return { status: 404, data: { error: "Not found" } };
  }
  const data = await response.json();
  return { status: response.status, data };
}

// ==================== POST /api/v1/marketplace/listings ====================

describe("POST /api/v1/marketplace/listings", () => {
  test("creates listing with all fields and imageUrls", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "Fresh Apples",
      description: "Organic apples from local farm",
      category: "produce",
      quantity: 5,
      unit: "kg",
      price: 3.5,
      originalPrice: 5.0,
      expiryDate: "2026-03-01",
      pickupLocation: "123 Main St",
      pickupInstructions: "Ring doorbell",
      imageUrls: ["uploads/listings/listing-1-abc.jpg", "uploads/listings/listing-1-def.png"],
    });

    expect(res.status).toBe(200);
    const data = res.data as {
      id: number;
      title: string;
      description: string;
      category: string;
      quantity: number;
      unit: string;
      price: number;
      originalPrice: number;
      images: string;
    };
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Fresh Apples");
    expect(data.description).toBe("Organic apples from local farm");
    expect(data.category).toBe("produce");
    expect(data.quantity).toBe(5);
    expect(data.unit).toBe("kg");
    expect(data.price).toBe(3.5);
    expect(data.originalPrice).toBe(5.0);
    const images = JSON.parse(data.images);
    expect(images).toEqual(["uploads/listings/listing-1-abc.jpg", "uploads/listings/listing-1-def.png"]);
  });

  test("creates listing without images", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "Simple Listing",
      quantity: 1,
    });

    expect(res.status).toBe(200);
    const data = res.data as { id: number; title: string; images: string | null };
    expect(data.title).toBe("Simple Listing");
    expect(data.images).toBeNull();
  });

  test("rejects missing title", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      quantity: 5,
    });

    expect(res.status).toBe(400);
  });

  test("rejects invalid imageUrls format (http URLs)", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "Test",
      imageUrls: ["http://evil.com/x.jpg"],
    });

    expect(res.status).toBe(400);
    const data = res.data as { error: string };
    expect(data.error).toBe("Invalid image URL format");
  });

  test("rejects imageUrls with path traversal", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "Test",
      imageUrls: ["../../../etc/passwd"],
    });

    expect(res.status).toBe(400);
  });

  test("rejects more than 5 images", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "Test",
      imageUrls: [
        "uploads/listings/1.jpg",
        "uploads/listings/2.jpg",
        "uploads/listings/3.jpg",
        "uploads/listings/4.jpg",
        "uploads/listings/5.jpg",
        "uploads/listings/6.jpg",
      ],
    });

    expect(res.status).toBe(400);
  });

  test("stores coordinates in pickupLocation field", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "With Location",
      pickupLocation: "123 Main St",
      coordinates: { latitude: 1.3521, longitude: 103.8198 },
    });

    expect(res.status).toBe(200);
    const data = res.data as { pickupLocation: string };
    expect(data.pickupLocation).toBe("123 Main St|1.3521,103.8198");
  });
});

// ==================== GET /api/v1/marketplace/listings/:id ====================

describe("GET /api/v1/marketplace/listings/:id", () => {
  test("returns listing by id", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "Test Item",
      quantity: 3,
      category: "dairy",
    });
    const created = createRes.data as { id: number };

    const res = await makeRequest(router, "GET", `/api/v1/marketplace/listings/${created.id}`);

    expect(res.status).toBe(200);
    const data = res.data as { id: number; title: string; category: string; seller: { name: string } };
    expect(data.id).toBe(created.id);
    expect(data.title).toBe("Test Item");
    expect(data.category).toBe("dairy");
    expect(data.seller.name).toBe("Test User");
  });

  test("returns 404 for non-existent listing", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/marketplace/listings/99999");

    expect(res.status).toBe(404);
    const data = res.data as { error: string };
    expect(data.error).toBe("Listing not found");
  });
});

// ==================== PATCH /api/v1/marketplace/listings/:id ====================

describe("PATCH /api/v1/marketplace/listings/:id", () => {
  test("updates listing fields", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "Original Title",
      quantity: 1,
    });
    const created = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "PATCH",
      `/api/v1/marketplace/listings/${created.id}`,
      { title: "Updated Title", price: 9.99 }
    );

    expect(res.status).toBe(200);
    const data = res.data as { title: string; price: number };
    expect(data.title).toBe("Updated Title");
    expect(data.price).toBe(9.99);
  });

  test("updates imageUrls", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "With Images",
      imageUrls: ["uploads/listings/old.jpg"],
    });
    const created = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "PATCH",
      `/api/v1/marketplace/listings/${created.id}`,
      { imageUrls: ["uploads/listings/new1.jpg", "uploads/listings/new2.jpg"] }
    );

    expect(res.status).toBe(200);
    const data = res.data as { images: string };
    const images = JSON.parse(data.images);
    expect(images).toEqual(["uploads/listings/new1.jpg", "uploads/listings/new2.jpg"]);
  });

  test("returns 404 for non-existent listing", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/marketplace/listings/99999",
      { title: "Test" }
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 if not owner", async () => {
    // Create listing as testUser
    const ownerRouter = createRouter(testUserId);
    const createRes = await makeRequest(ownerRouter, "POST", "/api/v1/marketplace/listings", {
      title: "Owner's Listing",
      quantity: 1,
    });
    const created = createRes.data as { id: number };

    // Try to update as other user
    const otherRouter = createRouter(otherUserId);
    const res = await makeRequest(
      otherRouter,
      "PATCH",
      `/api/v1/marketplace/listings/${created.id}`,
      { title: "Hijacked" }
    );

    expect(res.status).toBe(404);
  });
});

// ==================== DELETE /api/v1/marketplace/listings/:id ====================

describe("DELETE /api/v1/marketplace/listings/:id", () => {
  test("deletes listing successfully", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/marketplace/listings", {
      title: "To Delete",
      quantity: 1,
    });
    const created = createRes.data as { id: number };

    const deleteRes = await makeRequest(
      router,
      "DELETE",
      `/api/v1/marketplace/listings/${created.id}`
    );

    expect(deleteRes.status).toBe(200);
    const data = deleteRes.data as { message: string };
    expect(data.message).toBe("Listing deleted");

    // Verify it's gone
    const getRes = await makeRequest(router, "GET", `/api/v1/marketplace/listings/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  test("returns 404 for non-existent listing", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "DELETE", "/api/v1/marketplace/listings/99999");

    expect(res.status).toBe(404);
  });

  test("returns 404 if not owner", async () => {
    // Create listing as testUser
    const ownerRouter = createRouter(testUserId);
    const createRes = await makeRequest(ownerRouter, "POST", "/api/v1/marketplace/listings", {
      title: "Owner's Listing",
      quantity: 1,
    });
    const created = createRes.data as { id: number };

    // Try to delete as other user
    const otherRouter = createRouter(otherUserId);
    const res = await makeRequest(
      otherRouter,
      "DELETE",
      `/api/v1/marketplace/listings/${created.id}`
    );

    expect(res.status).toBe(404);
  });
});
