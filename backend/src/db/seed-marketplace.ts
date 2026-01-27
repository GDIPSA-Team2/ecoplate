import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { hashPassword } from "../middleware/auth";

const sqlite = new Database("ecoplate.db");
const db = drizzle(sqlite, { schema });

console.log("Creating marketplace sample data...");

// Sample products near postal code 169648 (Queenstown area)
const sampleLocations = [
  {
    name: "Queenstown MRT",
    coords: { latitude: 1.2943, longitude: 103.8016 },
    address: "Queenstown MRT Station, Margaret Drive, Singapore 149305",
  },
  {
    name: "Queenstown Shopping Centre",
    coords: { latitude: 1.2947, longitude: 103.8005 },
    address: "1 Queensway, Singapore 149053",
  },
  {
    name: "Anchorvale Community Club",
    coords: { latitude: 1.2905, longitude: 103.8006 },
    address: "Anchorvale Street, Singapore 169648",
  },
  {
    name: "Commonwealth MRT",
    coords: { latitude: 1.3025, longitude: 103.7981 },
    address: "Commonwealth Avenue West, Singapore 129588",
  },
  {
    name: "IKEA Alexandra",
    coords: { latitude: 1.2869, longitude: 103.8040 },
    address: "317 Alexandra Road, Singapore 159965",
  },
];

const sampleProducts = [
  {
    title: "Fresh Organic Apples",
    description: "Sweet and crispy organic apples from local farm. Perfect condition!",
    category: "produce",
    quantity: 2,
    unit: "kg",
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 5,
    location: sampleLocations[0],
  },
  {
    title: "Whole Wheat Bread",
    description: "Freshly baked whole wheat bread. Slightly overproduced batch.",
    category: "bakery",
    quantity: 3,
    unit: "loaf",
    price: null, // FREE
    originalPrice: 4.5,
    expiryDays: 2,
    location: sampleLocations[1],
  },
  {
    title: "Fresh Milk (2L)",
    description: "Full cream fresh milk, unopened. Expiring soon.",
    category: "dairy",
    quantity: 2,
    unit: "l",
    price: 3.5,
    originalPrice: 6.0,
    expiryDays: 3,
    location: sampleLocations[2],
  },
  {
    title: "Mixed Vegetables Pack",
    description: "Assorted fresh vegetables - carrots, broccoli, lettuce. Great for cooking!",
    category: "produce",
    quantity: 1,
    unit: "pack",
    price: 4.0,
    originalPrice: 8.0,
    expiryDays: 4,
    location: sampleLocations[3],
  },
  {
    title: "Frozen Chicken Breast",
    description: "Premium frozen chicken breast. Must clear stock.",
    category: "meat",
    quantity: 1.5,
    unit: "kg",
    price: 8.0,
    originalPrice: 15.0,
    expiryDays: 7,
    location: sampleLocations[4],
  },
  {
    title: "Yogurt Multipack",
    description: "Assorted flavors yogurt pack. 6 cups included.",
    category: "dairy",
    quantity: 1,
    unit: "pack",
    price: 3.0,
    originalPrice: 6.5,
    expiryDays: 3,
    location: sampleLocations[0],
  },
  {
    title: "Fresh Orange Juice",
    description: "Freshly squeezed orange juice, no preservatives.",
    category: "beverages",
    quantity: 1,
    unit: "l",
    price: null, // FREE
    originalPrice: 5.0,
    expiryDays: 1,
    location: sampleLocations[1],
  },
  {
    title: "Chocolate Cake",
    description: "Homemade chocolate cake. Perfect for dessert!",
    category: "bakery",
    quantity: 1,
    unit: "item",
    price: 6.0,
    originalPrice: 12.0,
    expiryDays: 2,
    location: sampleLocations[2],
  },
];

(async () => {
  try {
    // Get or create demo user
    let demoUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, "demo@ecoplate.com"),
    });

    if (!demoUser) {
      console.log("Creating demo user...");
      const passwordHash = await hashPassword("demo123");

      [demoUser] = await db
        .insert(schema.users)
        .values({
          email: "demo@ecoplate.com",
          passwordHash,
          name: "Demo User",
          userLocation: "Singapore 169648",
          avatarUrl: "avatar1",
        })
        .returning();

      // Initialize user points and metrics
      await db.insert(schema.userPoints).values({ userId: demoUser.id });
      await db
        .insert(schema.userSustainabilityMetrics)
        .values({ userId: demoUser.id });
    }

    console.log(`Using user: ${demoUser.email} (ID: ${demoUser.id})`);

    // Delete existing marketplace listings
    console.log("Clearing existing marketplace listings...");
    await db.delete(schema.marketplaceListings);

    // Create sample listings
    console.log("Creating sample marketplace listings...");

    for (const product of sampleProducts) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + product.expiryDays);

      // Store coordinates in pickupLocation as "lat,lng" format for now
      // This will be parsed by the frontend
      const locationWithCoords = `${product.location.address}|${product.location.coords.latitude},${product.location.coords.longitude}`;

      await db.insert(schema.marketplaceListings).values({
        sellerId: demoUser.id,
        title: product.title,
        description: product.description,
        category: product.category,
        quantity: product.quantity,
        unit: product.unit,
        price: product.price,
        originalPrice: product.originalPrice,
        expiryDate,
        pickupLocation: locationWithCoords,
        status: "active",
      });

      console.log(`  ✓ Created: ${product.title} at ${product.location.name}`);
    }

    console.log(`\n✓ Successfully created ${sampleProducts.length} sample listings!`);
    console.log(`\nAll listings are near postal code 169648 (Queenstown area)`);
    console.log(
      `View them on the marketplace map at http://localhost:3000/marketplace`
    );
  } catch (error) {
    console.error(`✗ Failed to create sample data:`, error);
  }

  sqlite.close();
})();
