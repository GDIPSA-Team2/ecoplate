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
  price: real("price"),
  originalPrice: real("original_price"),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  pickupLocation: text("pickup_location"),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const listingImages = sqliteTable("listing_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
});

// ==================== Communication ====================

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id),
  buyerId: integer("buyer_id")
    .notNull()
    .references(() => users.id),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id") // Sender of the message
    .notNull()
    .references(() => users.id),
  messageText: text("message_text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== ProductsSustainability ====================

export const productSustainabilityMetrics = sqliteTable(
  "product_sustainability_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    todayDate: integer("today_date", { mode: "timestamp" }).notNull(),
    quantity: real("quantity").notNull(),
    type: text("type").notNull(), // e.g., 'saved', 'wasted'
  },
);

// ==================== Gamification ====================

export const userPoints = sqliteTable("user_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").default(0),
  currentStreak: integer("current_streak").default(0),
});

// export const pointTransactions = sqliteTable("point_transactions", {
//   id: integer("id").primaryKey({ autoIncrement: true }),
//   userId: integer("user_id")
//     .notNull()
//     .references(() => users.id, { onDelete: "cascade" }),
//   amount: integer("amount").notNull(),
//   type: text("type").notNull(),
//   action: text("action").notNull(),
//   createdAt: integer("created_at", { mode: "timestamp" })
//     .notNull()
//     .$defaultFn(() => new Date()),
// });

export const badges = sqliteTable("badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  pointsAwarded: integer("points_awarded").default(0),
  badgeImageUrl: text("badge_image_url"),
});

export const userBadges = sqliteTable("user_badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id")
    .notNull()
    .references(() => badges.id, { onDelete: "cascade" }),
  earnedAt: integer("earned_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Relations ====================

export const usersRelations = relations(users, ({ many, one }) => ({
  products: many(products),
  listings: many(marketplaceListings, { relationName: "seller" }),
  purchases: many(marketplaceListings, { relationName: "buyer" }),
  points: one(userPoints),
  // pointTransactions: many(pointTransactions),
  badges: many(userBadges),
  messages: many(messages),
}));

export const marketplaceListingsRelations = relations(
  marketplaceListings,
  ({ one, many }) => ({
    seller: one(users, {
      fields: [marketplaceListings.sellerId],
      references: [users.id],
      relationName: "seller",
    }),
    buyer: one(users, {
      fields: [marketplaceListings.buyerId],
      references: [users.id],
      relationName: "buyer",
    }),
    product: one(products, {
      fields: [marketplaceListings.productId],
      references: [products.id],
    }),
    images: many(listingImages),
    conversations: many(conversations),
  }),
);

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    listing: one(marketplaceListings, {
      fields: [conversations.listingId],
      references: [marketplaceListings.id],
    }),
    seller: one(users, {
      fields: [conversations.sellerId],
      references: [users.id],
    }),
    buyer: one(users, {
      fields: [conversations.buyerId],
      references: [users.id],
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
  badge: one(badges, { fields: [userBadges.badgeId], references: [badges.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, { fields: [products.userId], references: [users.id] }),
  metrics: many(productSustainabilityMetrics),
}));
