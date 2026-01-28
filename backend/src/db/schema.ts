import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ==================== Users ====================

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  userLocation: text("user_location"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Products (MyFridge) ====================

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  category: text("category"),
  quantity: real("quantity").notNull(),
  unit: text("unit"), // e.g., "kg", "L", "pcs", "bottles"
  unitPrice: real("unit_price"),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  description: text("description"),
  co2Emission: real("co2_emission"),
});

// ==================== Marketplace Listings ====================

export const marketplaceListings = sqliteTable("marketplace_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  quantity: real("quantity").notNull(),
  unit: text("unit"), // e.g., "kg", "L", "pcs", "bottles"
  price: real("price"),
  originalPrice: real("original_price"),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  pickupLocation: text("pickup_location"),
  images: text("images"), // JSON array of image URLs: ["uploads/marketplace/abc.jpg", ...]
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// ==================== Messages ====================

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Relations ====================

export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  listings: many(marketplaceListings),
  purchases: many(marketplaceListings),
  sentMessages: many(messages),
  receivedMessages: many(messages),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, {
    fields: [products.userId],
    references: [users.id],
  }),
  listings: many(marketplaceListings),
}));

export const marketplaceListingsRelations = relations(
  marketplaceListings,
  ({ one, many }) => ({
    seller: one(users, {
      fields: [marketplaceListings.sellerId],
      references: [users.id],
    }),
    buyer: one(users, {
      fields: [marketplaceListings.buyerId],
      references: [users.id],
    }),
    product: one(products, {
      fields: [marketplaceListings.productId],
      references: [products.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [messages.listingId],
    references: [marketplaceListings.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
  }),
}));
