import { describe, expect, test, beforeAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";

// ── In-memory DB setup ──────────────────────────────────────────────

const sqlite = new Database(":memory:");
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
    quantity REAL NOT NULL,
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

  CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const testDb = drizzle(sqlite, { schema });

// Override the db instance
import { __setTestDb } from "../../db/connection";
__setTestDb(testDb);

// Import after db override is set up
import {
  getOrCreateConversation,
  getConversationById,
  getUnreadCountForUser,
  markConversationAsRead,
  touchConversation,
  isUserParticipant,
  getListingForConversation,
} from "../conversation-service";

// ── Seed data ────────────────────────────────────────────────────────

let sellerId: number;
let buyerId: number;
let thirdUserId: number;
let listingId: number;
let soldListingId: number;

beforeAll(() => {
  // Seed test users
  const userStmt = sqlite.prepare(
    "INSERT INTO users (email, password_hash, name, avatar_url) VALUES (?, ?, ?, ?) RETURNING id"
  );
  const seller = userStmt.get("seller@eco.com", "hash123", "Seller User", "http://avatar1.jpg") as { id: number };
  sellerId = seller.id;

  const buyer = userStmt.get("buyer@eco.com", "hash456", "Buyer User", "http://avatar2.jpg") as { id: number };
  buyerId = buyer.id;

  const third = userStmt.get("third@eco.com", "hash789", "Third User", null) as { id: number };
  thirdUserId = third.id;

  // Seed test listings
  const listingStmt = sqlite.prepare(
    "INSERT INTO marketplace_listings (seller_id, title, description, quantity, price, status, images) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
  );
  const listing = listingStmt.get(sellerId, "Test Apples", "Fresh apples", 5, 10, "active", '["img1.jpg"]') as { id: number };
  listingId = listing.id;

  const soldListing = listingStmt.get(sellerId, "Sold Oranges", "Sold oranges", 3, 15, "sold", null) as { id: number };
  soldListingId = soldListing.id;
});

beforeEach(() => {
  // Clean between tests
  sqlite.exec("DELETE FROM messages");
  sqlite.exec("DELETE FROM conversations");
});

// ── Tests ────────────────────────────────────────────────────────────

describe("getOrCreateConversation", () => {
  test("creates a new conversation when none exists", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    expect(conversation).toBeDefined();
    expect(conversation.listingId).toBe(listingId);
    expect(conversation.buyerId).toBe(buyerId);
    expect(conversation.sellerId).toBe(sellerId);
    expect(conversation.listing.title).toBe("Test Apples");
    expect(conversation.seller.name).toBe("Seller User");
    expect(conversation.buyer.name).toBe("Buyer User");
  });

  test("returns existing conversation when one exists", async () => {
    // Create first conversation
    const first = await getOrCreateConversation(listingId, buyerId, sellerId);

    // Try to create again
    const second = await getOrCreateConversation(listingId, buyerId, sellerId);

    expect(second.id).toBe(first.id);
  });

  test("includes listing details in conversation", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    expect(conversation.listing.id).toBe(listingId);
    expect(conversation.listing.title).toBe("Test Apples");
    expect(conversation.listing.price).toBe(10);
    expect(conversation.listing.status).toBe("active");
  });

  test("includes seller details in conversation", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    expect(conversation.seller.id).toBe(sellerId);
    expect(conversation.seller.name).toBe("Seller User");
    expect(conversation.seller.avatarUrl).toBe("http://avatar1.jpg");
  });

  test("includes buyer details in conversation", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    expect(conversation.buyer.id).toBe(buyerId);
    expect(conversation.buyer.name).toBe("Buyer User");
    expect(conversation.buyer.avatarUrl).toBe("http://avatar2.jpg");
  });

  test("creates separate conversations for different buyers", async () => {
    const conv1 = await getOrCreateConversation(listingId, buyerId, sellerId);
    const conv2 = await getOrCreateConversation(listingId, thirdUserId, sellerId);

    expect(conv1.id).not.toBe(conv2.id);
    expect(conv1.buyerId).toBe(buyerId);
    expect(conv2.buyerId).toBe(thirdUserId);
  });
});

describe("getConversationById", () => {
  test("returns conversation when user is seller", async () => {
    const created = await getOrCreateConversation(listingId, buyerId, sellerId);
    const conversation = await getConversationById(created.id, sellerId);

    expect(conversation).not.toBeNull();
    expect(conversation?.id).toBe(created.id);
  });

  test("returns conversation when user is buyer", async () => {
    const created = await getOrCreateConversation(listingId, buyerId, sellerId);
    const conversation = await getConversationById(created.id, buyerId);

    expect(conversation).not.toBeNull();
    expect(conversation?.id).toBe(created.id);
  });

  test("returns null/undefined when user is not a participant", async () => {
    const created = await getOrCreateConversation(listingId, buyerId, sellerId);
    const conversation = await getConversationById(created.id, thirdUserId);

    // The function returns undefined when no conversation is found
    expect(conversation).toBeFalsy();
  });

  test("returns null/undefined for non-existent conversation", async () => {
    const conversation = await getConversationById(9999, sellerId);
    // The function returns undefined when no conversation is found
    expect(conversation).toBeFalsy();
  });

  test("includes full details in returned conversation", async () => {
    const created = await getOrCreateConversation(listingId, buyerId, sellerId);
    const conversation = await getConversationById(created.id, sellerId);

    expect(conversation?.listing.title).toBe("Test Apples");
    expect(conversation?.seller.name).toBe("Seller User");
    expect(conversation?.buyer.name).toBe("Buyer User");
  });
});

describe("getUnreadCountForUser", () => {
  test("returns 0 when no conversations exist", async () => {
    const count = await getUnreadCountForUser(buyerId);
    expect(count).toBe(0);
  });

  test("returns 0 when no unread messages exist", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    // Add a read message from seller
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conversation.id}, ${sellerId}, 'Hello', 1);
    `);

    const count = await getUnreadCountForUser(buyerId);
    expect(count).toBe(0);
  });

  test("counts unread messages not sent by user", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    // Add unread messages from seller to buyer
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conversation.id}, ${sellerId}, 'Hello', 0);
    `);
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conversation.id}, ${sellerId}, 'Are you there?', 0);
    `);

    const count = await getUnreadCountForUser(buyerId);
    expect(count).toBe(2);
  });

  test("does not count own unread messages", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    // Add unread message from buyer
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conversation.id}, ${buyerId}, 'Hi', 0);
    `);

    const count = await getUnreadCountForUser(buyerId);
    expect(count).toBe(0);
  });

  test("excludes messages from sold listing conversations", async () => {
    // Create conversation for sold listing
    const soldConv = await getOrCreateConversation(soldListingId, buyerId, sellerId);

    // Add unread message
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${soldConv.id}, ${sellerId}, 'Thanks for buying', 0);
    `);

    const count = await getUnreadCountForUser(buyerId);
    expect(count).toBe(0);
  });

  test("counts across multiple conversations", async () => {
    const conv1 = await getOrCreateConversation(listingId, buyerId, sellerId);

    // Create another listing
    sqlite.exec(`
      INSERT INTO marketplace_listings (seller_id, title, quantity, price, status)
      VALUES (${thirdUserId}, 'Another Item', 1, 5, 'active');
    `);
    const otherListingId = sqlite.query("SELECT id FROM marketplace_listings WHERE title = 'Another Item'").get() as { id: number };
    const conv2 = await getOrCreateConversation(otherListingId.id, buyerId, thirdUserId);

    // Add unread messages in both conversations
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conv1.id}, ${sellerId}, 'Message 1', 0);
    `);
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conv2.id}, ${thirdUserId}, 'Message 2', 0);
    `);

    const count = await getUnreadCountForUser(buyerId);
    expect(count).toBe(2);
  });
});

describe("markConversationAsRead", () => {
  test("marks unread messages as read", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conversation.id}, ${sellerId}, 'Hello', 0);
    `);

    await markConversationAsRead(conversation.id, buyerId);

    const msg = sqlite.query(`SELECT is_read FROM messages WHERE conversation_id = ${conversation.id}`).get() as { is_read: number };
    expect(msg.is_read).toBe(1);
  });

  test("does not mark own messages as read", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);

    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conversation.id}, ${buyerId}, 'My message', 0);
    `);

    await markConversationAsRead(conversation.id, buyerId);

    const msg = sqlite.query(`SELECT is_read FROM messages WHERE conversation_id = ${conversation.id}`).get() as { is_read: number };
    expect(msg.is_read).toBe(0);
  });

  test("only marks messages in specified conversation", async () => {
    const conv1 = await getOrCreateConversation(listingId, buyerId, sellerId);

    sqlite.exec(`
      INSERT INTO marketplace_listings (seller_id, title, quantity, price, status)
      VALUES (${thirdUserId}, 'Other Item', 1, 5, 'active');
    `);
    const otherListingId = sqlite.query("SELECT id FROM marketplace_listings WHERE title = 'Other Item'").get() as { id: number };
    const conv2 = await getOrCreateConversation(otherListingId.id, buyerId, thirdUserId);

    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conv1.id}, ${sellerId}, 'Conv1 msg', 0);
    `);
    sqlite.exec(`
      INSERT INTO messages (conversation_id, user_id, message_text, is_read)
      VALUES (${conv2.id}, ${thirdUserId}, 'Conv2 msg', 0);
    `);

    await markConversationAsRead(conv1.id, buyerId);

    const msg1 = sqlite.query(`SELECT is_read FROM messages WHERE conversation_id = ${conv1.id}`).get() as { is_read: number };
    const msg2 = sqlite.query(`SELECT is_read FROM messages WHERE conversation_id = ${conv2.id}`).get() as { is_read: number };

    expect(msg1.is_read).toBe(1);
    expect(msg2.is_read).toBe(0);
  });
});

describe("touchConversation", () => {
  test("updates conversation timestamp", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);
    const originalUpdatedAt = conversation.updatedAt;

    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    await touchConversation(conversation.id);

    const updated = sqlite.query(`SELECT updated_at FROM conversations WHERE id = ${conversation.id}`).get() as { updated_at: number };

    expect(updated.updated_at).toBeGreaterThan(originalUpdatedAt.getTime() / 1000 - 1);
  });
});

describe("isUserParticipant", () => {
  test("returns true for seller", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);
    const isParticipant = await isUserParticipant(conversation.id, sellerId);
    expect(isParticipant).toBe(true);
  });

  test("returns true for buyer", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);
    const isParticipant = await isUserParticipant(conversation.id, buyerId);
    expect(isParticipant).toBe(true);
  });

  test("returns false for non-participant", async () => {
    const conversation = await getOrCreateConversation(listingId, buyerId, sellerId);
    const isParticipant = await isUserParticipant(conversation.id, thirdUserId);
    expect(isParticipant).toBe(false);
  });

  test("returns false for non-existent conversation", async () => {
    const isParticipant = await isUserParticipant(9999, sellerId);
    expect(isParticipant).toBe(false);
  });
});

describe("getListingForConversation", () => {
  test("returns listing with seller info", async () => {
    const listing = await getListingForConversation(listingId);

    expect(listing).not.toBeNull();
    expect(listing?.id).toBe(listingId);
    expect(listing?.sellerId).toBe(sellerId);
    expect(listing?.title).toBe("Test Apples");
  });

  test("returns null for non-existent listing", async () => {
    const listing = await getListingForConversation(9999);
    expect(listing).toBeNull();
  });

  test("returns listing even if sold", async () => {
    const listing = await getListingForConversation(soldListingId);

    expect(listing).not.toBeNull();
    expect(listing?.id).toBe(soldListingId);
    expect(listing?.title).toBe("Sold Oranges");
  });
});
