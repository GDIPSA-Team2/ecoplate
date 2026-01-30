import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
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
  {
    email: "charlie@demo.com",
    password: "demo123",
    name: "Charlie Lim",
    userLocation: "Tampines, Singapore 529510",
  },
  {
    email: "diana@demo.com",
    password: "demo123",
    name: "Diana Chen",
    userLocation: "Jurong East, Singapore 609731",
  },
  {
    email: "evan@demo.com",
    password: "demo123",
    name: "Evan Ng",
    userLocation: "Bishan, Singapore 570283",
  },
];

// Sample products (MyFridge items) with co2Emission data for dashboard charts
// Every product MUST have co2Emission so dashboard CO2 charts have data
const sampleProducts = [
  // --- Alice's products ---
  { productName: "Fresh Organic Apples", category: "produce", quantity: 5.0, unit: "kg", unitPrice: 6.0, co2Emission: 0.4, description: "Organic apples from local farm", daysAgo: 2, ownerIndex: 0 },
  { productName: "Whole Wheat Bread", category: "bakery", quantity: 2.0, unit: "pcs", unitPrice: 2.25, co2Emission: 0.8, description: "Freshly baked whole wheat bread", daysAgo: 1, ownerIndex: 0 },
  { productName: "Chicken Breast", category: "meat", quantity: 1.5, unit: "kg", unitPrice: 12.0, co2Emission: 6.9, description: "Free range chicken breast", daysAgo: 3, ownerIndex: 0 },
  { productName: "Brown Rice", category: "pantry", quantity: 5.0, unit: "kg", unitPrice: 8.0, co2Emission: 2.7, description: "Organic brown rice", daysAgo: 10, ownerIndex: 0 },
  { productName: "Fresh Salmon", category: "meat", quantity: 0.8, unit: "kg", unitPrice: 18.0, co2Emission: 3.5, description: "Norwegian salmon fillet", daysAgo: 1, ownerIndex: 0 },
  // --- Bob's products ---
  { productName: "Greek Yogurt", category: "dairy", quantity: 3.0, unit: "pcs", unitPrice: 4.5, co2Emission: 1.2, description: "Creamy Greek yogurt", daysAgo: 3, ownerIndex: 1 },
  { productName: "Organic Milk", category: "dairy", quantity: 2.0, unit: "L", unitPrice: 5.0, co2Emission: 1.4, description: "Fresh organic whole milk", daysAgo: 1, ownerIndex: 1 },
  { productName: "Eggs Free Range", category: "dairy", quantity: 12.0, unit: "pcs", unitPrice: 6.0, co2Emission: 2.0, description: "Free range eggs", daysAgo: 2, ownerIndex: 1 },
  { productName: "Cheddar Cheese", category: "dairy", quantity: 0.5, unit: "kg", unitPrice: 10.0, co2Emission: 4.2, description: "Aged cheddar cheese block", daysAgo: 5, ownerIndex: 1 },
  // --- Charlie's products ---
  { productName: "Bananas", category: "produce", quantity: 2.0, unit: "kg", unitPrice: 3.0, co2Emission: 0.7, description: "Ripe bananas from Malaysia", daysAgo: 1, ownerIndex: 2 },
  { productName: "Beef Mince", category: "meat", quantity: 1.0, unit: "kg", unitPrice: 14.0, co2Emission: 27.0, description: "Premium Australian beef mince", daysAgo: 2, ownerIndex: 2 },
  { productName: "Pasta Spaghetti", category: "pantry", quantity: 1.0, unit: "kg", unitPrice: 4.5, co2Emission: 1.2, description: "Italian spaghetti", daysAgo: 7, ownerIndex: 2 },
  { productName: "Tomatoes", category: "produce", quantity: 1.5, unit: "kg", unitPrice: 4.0, co2Emission: 0.5, description: "Vine-ripened tomatoes", daysAgo: 2, ownerIndex: 2 },
  // --- Diana's products ---
  { productName: "Tofu", category: "produce", quantity: 2.0, unit: "pcs", unitPrice: 3.0, co2Emission: 0.8, description: "Organic firm tofu", daysAgo: 1, ownerIndex: 3 },
  { productName: "Frozen Dumplings", category: "frozen", quantity: 2.0, unit: "pcs", unitPrice: 8.0, co2Emission: 2.5, description: "Homemade pork dumplings", daysAgo: 5, ownerIndex: 3 },
  { productName: "Spinach", category: "produce", quantity: 0.5, unit: "kg", unitPrice: 3.5, co2Emission: 0.3, description: "Fresh organic spinach", daysAgo: 1, ownerIndex: 3 },
  { productName: "Pork Belly", category: "meat", quantity: 1.0, unit: "kg", unitPrice: 11.0, co2Emission: 7.6, description: "Fresh pork belly", daysAgo: 3, ownerIndex: 3 },
  // --- Evan's products ---
  { productName: "Strawberries", category: "produce", quantity: 0.5, unit: "kg", unitPrice: 9.0, co2Emission: 0.4, description: "Korean strawberries", daysAgo: 1, ownerIndex: 4 },
  { productName: "Orange Juice", category: "beverages", quantity: 2.0, unit: "L", unitPrice: 6.0, co2Emission: 0.9, description: "Fresh squeezed OJ", daysAgo: 2, ownerIndex: 4 },
  { productName: "Coconut Water", category: "beverages", quantity: 4.0, unit: "bottles", unitPrice: 10.0, co2Emission: 0.6, description: "Natural coconut water", daysAgo: 3, ownerIndex: 4 },
  { productName: "Lamb Chops", category: "meat", quantity: 0.6, unit: "kg", unitPrice: 22.0, co2Emission: 24.0, description: "NZ lamb loin chops", daysAgo: 1, ownerIndex: 4 },
];

// Sample marketplace listings
const sampleListings = [
  {
    title: "Fresh Organic Apples",
    description: "Sweet and crispy organic apples from local farm. Selling half my stock!",
    category: "produce",
    quantity: 2.0,
    unit: "kg",
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 5,
    location: "Queenstown MRT Station|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  {
    title: "Red Fuji Apples",
    description: "Imported Japanese Fuji apples, super sweet and crunchy. Bought too many!",
    category: "produce",
    quantity: 1.5,
    unit: "kg",
    price: 6.0,
    originalPrice: 15.0,
    expiryDays: 7,
    location: "Tampines Mall|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  {
    title: "Green Granny Smith Apples",
    description: "Tart and crisp green apples, perfect for baking or eating fresh.",
    category: "produce",
    quantity: 1.0,
    unit: "kg",
    price: 4.5,
    originalPrice: 10.0,
    expiryDays: 6,
    location: "Jurong Point|1.3397,103.7066",
    sellerIndex: 3, // Diana
  },
  // PRODUCE - Other fruits
  {
    title: "Fresh Bananas",
    description: "Ripe bananas from Malaysia. Perfect for smoothies or snacking.",
    category: "produce",
    quantity: 1.0,
    unit: "kg",
    price: 2.0,
    originalPrice: 4.0,
    expiryDays: 3,
    location: "Bishan MRT|1.3513,103.8492",
    sellerIndex: 4, // Evan
  },
  {
    title: "Organic Oranges",
    description: "Juicy navel oranges, great for fresh juice. Selling excess from bulk purchase.",
    category: "produce",
    quantity: 2.0,
    unit: "kg",
    price: 5.5,
    originalPrice: 12.0,
    expiryDays: 10,
    location: "Clementi MRT|1.3151,103.7654",
    sellerIndex: 1, // Bob
  },
  {
    title: "Fresh Strawberries",
    description: "Sweet Korean strawberries. Need to sell before they go bad!",
    category: "produce",
    quantity: 500,
    unit: "g",
    price: 4.0,
    originalPrice: 9.0,
    expiryDays: 2,
    location: "Tampines Hub|1.3535,103.9395",
    sellerIndex: 2, // Charlie
  },
  // PRODUCE - Vegetables
  {
    title: "Organic Spinach",
    description: "Fresh organic baby spinach leaves. Great for salads and smoothies.",
    category: "produce",
    quantity: 300,
    unit: "g",
    price: 2.5,
    originalPrice: 5.0,
    expiryDays: 3,
    location: "Jurong East MRT|1.3331,103.7422",
    sellerIndex: 3, // Diana
  },
  {
    title: "Fresh Tomatoes",
    description: "Vine-ripened tomatoes from Cameron Highlands. Perfect for cooking.",
    category: "produce",
    quantity: 1.0,
    unit: "kg",
    price: 3.0,
    originalPrice: 6.0,
    expiryDays: 5,
    location: "Queenstown|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  // DAIRY
  {
    title: "Fresh Milk 2L",
    description: "Meiji fresh milk, expiring soon but still good. Half price!",
    category: "dairy",
    quantity: 2,
    unit: "L",
    price: 3.5,
    originalPrice: 7.0,
    expiryDays: 2,
    location: "Bishan Junction 8|1.3500,103.8488",
    sellerIndex: 4, // Evan
  },
  {
    title: "Greek Yogurt Tub",
    description: "Fage Greek yogurt 500g. Bought extra, need to clear.",
    category: "dairy",
    quantity: 500,
    unit: "g",
    price: 4.0,
    originalPrice: 8.5,
    expiryDays: 5,
    location: "Clementi Mall|1.3148,103.7641",
    sellerIndex: 1, // Bob
  },
  {
    title: "Cheddar Cheese Block",
    description: "Mainland cheddar cheese. Opened but well-sealed. Great for sandwiches.",
    category: "dairy",
    quantity: 250,
    unit: "g",
    price: 3.0,
    originalPrice: 7.0,
    expiryDays: 14,
    location: "Tampines|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  // BAKERY
  {
    title: "Whole Wheat Bread",
    description: "Freshly baked whole wheat bread. Free to good home!",
    category: "bakery",
    quantity: 1,
    unit: "pcs",
    price: 0,
    originalPrice: 4.5,
    expiryDays: 2,
    location: "Clementi Mall|1.3148,103.7641",
    sellerIndex: 1, // Bob
  },
  {
    title: "Croissants Pack",
    description: "Pack of 4 butter croissants from BreadTalk. Still fresh!",
    category: "bakery",
    quantity: 4,
    unit: "pcs",
    price: 3.0,
    originalPrice: 8.0,
    expiryDays: 1,
    location: "Jurong Point|1.3397,103.7066",
    sellerIndex: 3, // Diana
  },
  {
    title: "Sourdough Loaf",
    description: "Artisan sourdough bread. Baked yesterday, still soft inside.",
    category: "bakery",
    quantity: 1,
    unit: "pcs",
    price: 4.0,
    originalPrice: 9.0,
    expiryDays: 3,
    location: "Bishan|1.3513,103.8492",
    sellerIndex: 4, // Evan
  },
  // MEAT
  {
    title: "Chicken Breast Pack",
    description: "Fresh chicken breast 500g. Bought too much for meal prep.",
    category: "meat",
    quantity: 500,
    unit: "g",
    price: 4.0,
    originalPrice: 8.0,
    expiryDays: 2,
    location: "Queenstown|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  {
    title: "Minced Beef",
    description: "Premium Australian minced beef. Great for burgers or pasta sauce.",
    category: "meat",
    quantity: 400,
    unit: "g",
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 1,
    location: "Tampines|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  // FROZEN
  {
    title: "Frozen Dumplings",
    description: "Homemade frozen pork dumplings. 20 pieces per pack.",
    category: "frozen",
    quantity: 20,
    unit: "pcs",
    price: 6.0,
    originalPrice: 12.0,
    expiryDays: 30,
    location: "Jurong East|1.3331,103.7422",
    sellerIndex: 3, // Diana
  },
  {
    title: "Frozen Mixed Vegetables",
    description: "Birds Eye frozen mixed veggies. Unopened pack.",
    category: "frozen",
    quantity: 500,
    unit: "g",
    price: 2.5,
    originalPrice: 5.5,
    expiryDays: 60,
    location: "Bishan|1.3513,103.8492",
    sellerIndex: 4, // Evan
  },
  // BEVERAGES
  {
    title: "Orange Juice Carton",
    description: "Tropicana pure premium OJ. Opened yesterday, still fresh.",
    category: "beverages",
    quantity: 1,
    unit: "L",
    price: 2.0,
    originalPrice: 6.0,
    expiryDays: 3,
    location: "Clementi|1.3151,103.7654",
    sellerIndex: 1, // Bob
  },
  {
    title: "Coconut Water Pack",
    description: "UFC coconut water 6-pack. Selling 4 remaining bottles.",
    category: "beverages",
    quantity: 4,
    unit: "bottles",
    price: 4.0,
    originalPrice: 10.0,
    expiryDays: 30,
    location: "Queenstown|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  // PANTRY
  {
    title: "Pasta Pack",
    description: "Barilla spaghetti 500g. Bought by mistake, prefer penne.",
    category: "pantry",
    quantity: 500,
    unit: "g",
    price: 2.0,
    originalPrice: 4.5,
    expiryDays: 180,
    location: "Tampines|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  {
    title: "Canned Tuna",
    description: "Ayam Brand tuna chunks in water. 3 cans available.",
    category: "pantry",
    quantity: 3,
    unit: "pcs",
    price: 4.5,
    originalPrice: 9.0,
    expiryDays: 365,
    location: "Jurong|1.3397,103.7066",
    sellerIndex: 3, // Diana
  },
];

// Sample conversation messages
const sampleConversationMessages = [
  { text: "Hi! Is this still available?", fromBuyer: true },
  { text: "Yes, it is! When would you like to pick it up?", fromBuyer: false },
  { text: "Can I come by tomorrow afternoon around 3pm?", fromBuyer: true },
  { text: "That works for me. See you then!", fromBuyer: false },
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
    try { sqlite.exec("DELETE FROM messages"); } catch (e) {}
    try { sqlite.exec("DELETE FROM conversations"); } catch (e) {}
    try { sqlite.exec("DELETE FROM product_interaction"); } catch (e) {}
    try { sqlite.exec("DELETE FROM user_points"); } catch (e) {}
    try { sqlite.exec("DELETE FROM marketplace_listings"); } catch (e) {}
    try { sqlite.exec("DELETE FROM products"); } catch (e) {}
    try { sqlite.exec("DELETE FROM users"); } catch (e) {}
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

    // Create user points for ALL users
    console.log("\nInitializing user points...");
    for (const user of createdUsers) {
      await db.insert(schema.userPoints).values({
        userId: user.id,
        totalPoints: 0,
        currentStreak: 0,
      });
      console.log(`  ✓ Points for ${user.name}`);
    }

    // Create products (MyFridge items)
    console.log("\nCreating sample products (MyFridge)...");
    const createdProducts: { id: number; productName: string; userId: number; quantity: number }[] = [];

    for (let i = 0; i < sampleProducts.length; i++) {
      const product = sampleProducts[i];
      const ownerIndex = product.ownerIndex !== undefined ? product.ownerIndex : (i % createdUsers.length);
      const owner = createdUsers[ownerIndex];

      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - product.daysAgo);

      const [created] = await db
        .insert(schema.products)
        .values({
          userId: owner.id,
          productName: product.productName,
          category: product.category,
          quantity: product.quantity,
          unit: product.unit,
          unitPrice: product.unitPrice,
          purchaseDate,
          description: product.description,
          co2Emission: product.co2Emission,
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

    // Create sustainability metrics for ALL users across 5 years
    // This ensures Annual/Month/Day views all have rich chart data
    console.log("\nCreating sustainability metrics (5 years of data for all users)...");
    const metricTypes: Array<"consumed" | "sold" | "shared" | "wasted"> = [
      "consumed", "consumed", "consumed", "sold", "shared", "wasted",
    ];
    let metricCount = 0;

    for (const user of createdUsers) {
      const userProducts = createdProducts.filter((p) => p.userId === user.id);
      if (userProducts.length === 0) continue;

      // ---- Annual data: 5 years, monthly granularity ----
      for (let monthsAgo = 59; monthsAgo >= 0; monthsAgo--) {
        // Growth trend: older months have fewer entries, recent months have more
        const baseEntries = 3 + Math.round((59 - monthsAgo) * 0.15);
        const entriesThisMonth = baseEntries + Math.floor(Math.random() * 3);

        for (let e = 0; e < entriesThisMonth; e++) {
          const product = userProducts[Math.floor(Math.random() * userProducts.length)];
          const metricDate = new Date();
          metricDate.setMonth(metricDate.getMonth() - monthsAgo);
          metricDate.setDate(1 + Math.floor(Math.random() * 27));

          const type = metricTypes[Math.floor(Math.random() * metricTypes.length)];
          const qty = 0.2 + Math.random() * 2.5;

          await db.insert(schema.ProductSustainabilityMetrics).values({
            productId: product.id,
            userId: user.id,
            todayDate: metricDate,
            quantity: Math.round(qty * 100) / 100,
            type,
          });
          metricCount++;
        }
      }

      // ---- Daily data: last 30 days, finer granularity for Day view ----
      for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
        const entriesThisDay = 2 + Math.floor(Math.random() * 4);
        for (let e = 0; e < entriesThisDay; e++) {
          const product = userProducts[Math.floor(Math.random() * userProducts.length)];
          const metricDate = new Date();
          metricDate.setDate(metricDate.getDate() - daysAgo);
          metricDate.setHours(7 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));

          const type = metricTypes[Math.floor(Math.random() * metricTypes.length)];
          const qty = 0.1 + Math.random() * 1.8;

          await db.insert(schema.ProductSustainabilityMetrics).values({
            productId: product.id,
            userId: user.id,
            todayDate: metricDate,
            quantity: Math.round(qty * 100) / 100,
            type,
          });
          metricCount++;
        }
      }
    }

    console.log(`  ✓ Created ${metricCount} sustainability metric entries for ${createdUsers.length} users`);

    // Create marketplace listings
    console.log("\nCreating sample marketplace listings...");
    const createdListings: { id: number; sellerId: number; title: string }[] = [];

    for (let i = 0; i < sampleListings.length; i++) {
      const listing = sampleListings[i];
      const sellerIndex = listing.sellerIndex !== undefined ? listing.sellerIndex : (i % createdUsers.length);
      const seller = createdUsers[sellerIndex];

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + listing.expiryDays);

      const [created] = await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        quantity: listing.quantity,
        unit: listing.unit,
        price: listing.price,
        originalPrice: listing.originalPrice,
        expiryDate,
        pickupLocation: listing.location,
        status: "active",
      }).returning();

      createdListings.push({ id: created.id, sellerId: seller.id, title: created.title });
      console.log(`  ✓ "${listing.title}" by ${seller.name}`);
    }

    // Create sold marketplace listings with completedAt (for dashboard money saved)
    console.log("\nCreating sold marketplace listings (historical)...");
    const soldItems = [
      { title: "Leftover Rice Noodles", price: 3.0, monthsAgo: 1, sellerIdx: 0 },
      { title: "Extra Soy Sauce", price: 2.5, monthsAgo: 1, sellerIdx: 0 },
      { title: "Surplus Eggs", price: 4.0, monthsAgo: 2, sellerIdx: 0 },
      { title: "Organic Carrots", price: 3.5, monthsAgo: 3, sellerIdx: 0 },
      { title: "Almond Milk", price: 5.0, monthsAgo: 5, sellerIdx: 0 },
      { title: "Canned Beans", price: 2.0, monthsAgo: 8, sellerIdx: 0 },
      { title: "Frozen Peas", price: 3.0, monthsAgo: 12, sellerIdx: 0 },
      { title: "Pasta Sauce", price: 4.0, monthsAgo: 18, sellerIdx: 0 },
      { title: "Extra Butter", price: 3.5, monthsAgo: 24, sellerIdx: 0 },
      { title: "Old Bread Loaf", price: 1.0, monthsAgo: 36, sellerIdx: 0 },
      { title: "Yogurt Tub", price: 3.0, monthsAgo: 2, sellerIdx: 1 },
      { title: "Cheese Slices", price: 4.5, monthsAgo: 4, sellerIdx: 1 },
      { title: "Extra Honey", price: 6.0, monthsAgo: 7, sellerIdx: 1 },
      { title: "Canned Tuna", price: 3.0, monthsAgo: 14, sellerIdx: 1 },
      { title: "Frozen Berries", price: 5.0, monthsAgo: 1, sellerIdx: 2 },
      { title: "Rice Bag 2kg", price: 4.0, monthsAgo: 3, sellerIdx: 2 },
      { title: "Extra Noodles", price: 2.5, monthsAgo: 10, sellerIdx: 2 },
      { title: "Miso Paste", price: 4.0, monthsAgo: 2, sellerIdx: 3 },
      { title: "Sesame Oil", price: 3.5, monthsAgo: 6, sellerIdx: 3 },
      { title: "Dried Mushrooms", price: 5.0, monthsAgo: 15, sellerIdx: 3 },
      { title: "Coconut Cream", price: 3.0, monthsAgo: 1, sellerIdx: 4 },
      { title: "Granola Bars", price: 4.0, monthsAgo: 4, sellerIdx: 4 },
      { title: "Trail Mix", price: 5.5, monthsAgo: 9, sellerIdx: 4 },
    ];

    for (const item of soldItems) {
      const seller = createdUsers[item.sellerIdx];
      const completedAt = new Date();
      completedAt.setMonth(completedAt.getMonth() - item.monthsAgo);
      completedAt.setDate(5 + Math.floor(Math.random() * 20));

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        title: item.title,
        description: `Sold item - ${item.title}`,
        category: "pantry",
        quantity: 1,
        unit: "pcs",
        price: item.price,
        originalPrice: item.price * 2,
        status: "sold",
        completedAt,
      });
    }
    console.log(`  ✓ Created ${soldItems.length} sold listings`);

    // Create sample conversations and messages
    console.log("\nCreating sample conversations and messages...");

    // Create a conversation for the first listing (Alice's apples, Bob inquiring)
    const listing1 = createdListings[0]; // Alice's apples
    const alice = createdUsers[0]; // Alice (seller)
    const bob = createdUsers[1]; // Bob (buyer)

    const [conversation1] = await db.insert(schema.conversations).values({
      listingId: listing1.id,
      sellerId: alice.id,
      buyerId: bob.id,
    }).returning();

    console.log(`  ✓ Conversation for "${listing1.title}" between ${alice.name} and ${bob.name}`);

    // Add messages to the conversation
    for (let i = 0; i < sampleConversationMessages.length; i++) {
      const msg = sampleConversationMessages[i];
      const senderId = msg.fromBuyer ? bob.id : alice.id;

      // Add small delay between messages for ordering
      const messageDate = new Date();
      messageDate.setMinutes(messageDate.getMinutes() - (sampleConversationMessages.length - i));

      await db.insert(schema.messages).values({
        conversationId: conversation1.id,
        userId: senderId,
        messageText: msg.text,
        isRead: i < sampleConversationMessages.length - 1, // Last message unread
        createdAt: messageDate,
      });
    }

    console.log(`    Added ${sampleConversationMessages.length} messages`);

    // Update conversation timestamp
    await db.update(schema.conversations)
      .set({ updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversation1.id));

    console.log("\n========================================");
    console.log("Done! Demo accounts (password: demo123):");
    console.log("  - alice@demo.com (0 pts, 0 day streak)");
    console.log("  - bob@demo.com (0 pts, 0 day streak)");
    console.log("  - alice@demo.com (seller)");
    console.log("  - bob@demo.com (seller)");
    console.log("  - charlie@demo.com (seller)");
    console.log("  - diana@demo.com (seller)");
    console.log("  - evan@demo.com (seller)");
    console.log(`\nCreated ${createdListings.length} marketplace listings`);
    console.log("========================================\n");

  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }

  sqlite.close();
}

seed();
