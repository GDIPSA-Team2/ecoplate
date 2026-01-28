import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { hashPassword } from "../middleware/auth";

const sqlite = new Database("ecoplate.db");
const db = drizzle(sqlite, { schema });

console.log("Seeding database...\n");

// Demo users
const demoUsers = [
  {
    email: "alice@demo.com",
    password: "demo123",
    name: "Alice Wong",
    userLocation: "Queenstown, Singapore 169648",
  },
  {
    email: "bob@demo.com",
    password: "demo123",
    name: "Bob Tan",
    userLocation: "Clementi, Singapore 129588",
  },
];

// Sample products (MyFridge items)
const sampleProducts = [
  {
    productName: "Fresh Organic Apples",
    category: "produce",
    quantity: 5.0,
    unitPrice: 6.0,
    description: "Sweet and crispy organic apples from local farm",
    daysAgo: 2,
    expiryDays: 10,
  },
  {
    productName: "Whole Wheat Bread",
    category: "bakery",
    quantity: 2.0,
    unitPrice: 2.25,
    description: "Freshly baked whole wheat bread",
    daysAgo: 1,
    expiryDays: 5,
  },
  {
    productName: "Greek Yogurt",
    category: "dairy",
    quantity: 3.0,
    unitPrice: 4.5,
    description: "Creamy Greek yogurt with live cultures",
    daysAgo: 3,
    expiryDays: 14,
  },
  {
    productName: "Organic Milk",
    category: "dairy",
    quantity: 1.0,
    unitPrice: 5.0,
    description: "Fresh organic whole milk",
    daysAgo: 1,
    expiryDays: 7,
  },
];

// Sample marketplace listings
const sampleListings = [
  {
    title: "Fresh Organic Apples",
    description: "Sweet and crispy organic apples from local farm. Selling half my stock!",
    category: "produce",
    quantity: 2.0,
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 5,
    location: "Queenstown MRT Station, Singapore 149305",
  },
  {
    title: "Whole Wheat Bread",
    description: "Freshly baked whole wheat bread. Free to good home!",
    category: "bakery",
    quantity: 2.0,
    price: 0,
    originalPrice: 4.5,
    expiryDays: 2,
    location: "Clementi Mall, Singapore 129588",
  },
];

// Sample product interactions (per LDM)
const sampleInteractions = [
  { type: "consumed", quantity: 2.0, daysAgo: 5 },
  { type: "consumed", quantity: 1.0, daysAgo: 4 },
  { type: "shared", quantity: 3.0, daysAgo: 3 },
  { type: "consumed", quantity: 1.0, daysAgo: 2 },
  { type: "sold", quantity: 2.0, daysAgo: 1 },
];

async function seed() {
  try {
    // Clear existing data in correct order (respecting foreign keys)
    console.log("Clearing existing data...");
    try { sqlite.exec("DELETE FROM product_interaction"); } catch (e) {}
    try { sqlite.exec("DELETE FROM user_points"); } catch (e) {}
    sqlite.exec("DELETE FROM marketplace_listings");
    sqlite.exec("DELETE FROM products");
    sqlite.exec("DELETE FROM users");
    try { sqlite.exec("DELETE FROM sqlite_sequence"); } catch (e) {}

    // Create users
    console.log("Creating demo users...");
    const createdUsers: { id: number; name: string }[] = [];

    for (const user of demoUsers) {
      const passwordHash = await hashPassword(user.password);
      const [created] = await db
        .insert(schema.users)
        .values({
          email: user.email,
          passwordHash,
          name: user.name,
          userLocation: user.userLocation,
        })
        .returning();

      createdUsers.push({ id: created.id, name: created.name });
      console.log(`  ✓ ${user.email}`);
    }

    // Create user points for each user (per LDM: id, userId, total_points, current_streak)
    // Reset to 0 - points and streaks are earned through actions only
    console.log("\nInitializing user points...");
    const userPointsData = [
      { userId: createdUsers[0].id, totalPoints: 0, currentStreak: 0 },
      { userId: createdUsers[1].id, totalPoints: 0, currentStreak: 0 },
    ];

    for (const points of userPointsData) {
      await db.insert(schema.userPoints).values(points);
      console.log(`  ✓ Points for user ${points.userId}: ${points.totalPoints} pts, ${points.currentStreak} day streak`);
    }

    // Create products (MyFridge items)
    console.log("\nCreating sample products (MyFridge)...");
    const createdProducts: { id: number; productName: string; userId: number; quantity: number }[] = [];

    for (let i = 0; i < sampleProducts.length; i++) {
      const product = sampleProducts[i];
      const owner = createdUsers[i % createdUsers.length];

      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - product.daysAgo);

      const [created] = await db
        .insert(schema.products)
        .values({
          userId: owner.id,
          productName: product.productName,
          category: product.category,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          purchaseDate,
          description: product.description,
        })
        .returning();

      createdProducts.push({
        id: created.id,
        productName: created.productName,
        userId: owner.id,
        quantity: product.quantity
      });
      console.log(`  ✓ "${product.productName}" owned by ${owner.name}`);
    }

    // Create marketplace listings
    console.log("\nCreating sample marketplace listings...");
    for (let i = 0; i < sampleListings.length; i++) {
      const listing = sampleListings[i];
      const seller = createdUsers[i % createdUsers.length];
      const product = createdProducts[i % createdProducts.length];

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + listing.expiryDays);

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        productId: product.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        quantity: listing.quantity,
        price: listing.price,
        originalPrice: listing.originalPrice,
        expiryDate,
        pickupLocation: listing.location,
        status: "active",
      });

      console.log(`  ✓ "${listing.title}" by ${seller.name}`);
    }

    // Create product interactions (per LDM)
    console.log("\nCreating sample product interactions...");
    for (let i = 0; i < sampleInteractions.length; i++) {
      const interaction = sampleInteractions[i];
      const product = createdProducts[i % createdProducts.length];

      const todayDate = new Date();
      todayDate.setDate(todayDate.getDate() - interaction.daysAgo);

      await db.insert(schema.ProductSustainabilityMetrics).values({
        productId: product.id,
        userId: product.userId,
        todayDate,
        quantity: interaction.quantity,
        type: interaction.type,
      });

      console.log(`  ✓ ${interaction.type}: ${interaction.quantity} units`);
    }

    console.log("\n========================================");
    console.log("Done! Demo accounts (password: demo123):");
    console.log("  - alice@demo.com (0 pts, 0 day streak)");
    console.log("  - bob@demo.com (0 pts, 0 day streak)");
    console.log("========================================\n");

  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }

  sqlite.close();
}

seed();
