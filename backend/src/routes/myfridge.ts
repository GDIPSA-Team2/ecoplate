import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { products } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import { awardPoints, recordProductSustainabilityMetrics } from "../services/gamification-service";

const productSchema = z.object({
  name: z.string().min(1).max(200), // Frontend sends 'name', we map to 'productName'
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  description: z.string().optional(),
  co2Emission: z.number().optional(),
});

// Helper to map backend product to frontend format
function mapProductToFrontend(product: any) {
  return {
    id: product.id,
    name: product.productName, // Map productName to name for frontend
    category: product.category,
    quantity: product.quantity,
    unitPrice: product.unitPrice,
    purchaseDate: product.purchaseDate,
    description: product.description,
    co2Emission: product.co2Emission,
  };
}

const consumeSchema = z.object({
  action: z.enum(["consumed", "wasted", "shared", "sold"]),
});

export function registerMyFridgeRoutes(router: Router) {
  // Get all products for the current user
  router.get("/api/v1/myfridge/products", async (req) => {
    const user = getUser(req);

    const userProducts = await db.query.products.findMany({
      where: eq(products.userId, user.id),
      orderBy: [desc(products.id)],
    });

    // Map to frontend format
    return json(userProducts.map(mapProductToFrontend));
  });

  // Get single product
  router.get("/api/v1/myfridge/products/:id", async (req, params) => {
    const user = getUser(req);
    const productId = parseInt(params.id, 10);

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.userId, user.id)
      ),
    });

    if (!product) {
      return error("Product not found", 404);
    }

    return json(mapProductToFrontend(product));
  });

  // Add new product
  router.post("/api/v1/myfridge/products", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);
      const data = productSchema.parse(body);

      const [product] = await db
        .insert(products)
        .values({
          userId: user.id,
          productName: data.name, // Map 'name' from frontend to 'productName' in DB
          category: data.category,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          description: data.description,
          co2Emission: data.co2Emission,
        })
        .returning();

      return json(mapProductToFrontend(product));
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Add product error:", e);
      return error("Failed to add product", 500);
    }
  });

  // Update product
  router.patch("/api/v1/myfridge/products/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const productId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = productSchema.partial().parse(body);

      const existing = await db.query.products.findFirst({
        where: and(
          eq(products.id, productId),
          eq(products.userId, user.id)
        ),
      });

      if (!existing) {
        return error("Product not found", 404);
      }

      const [updated] = await db
        .update(products)
        .set({
          productName: data.name, // Map 'name' from frontend to 'productName' in DB
          category: data.category,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : existing.purchaseDate,
          description: data.description,
          co2Emission: data.co2Emission,
        })
        .where(eq(products.id, productId))
        .returning();

      return json(mapProductToFrontend(updated));
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Update product error:", e);
      return error("Failed to update product", 500);
    }
  });

  // Delete product
  router.delete("/api/v1/myfridge/products/:id", async (req, params) => {
    const user = getUser(req);
    const productId = parseInt(params.id, 10);

    const existing = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.userId, user.id)
      ),
    });

    if (!existing) {
      return error("Product not found", 404);
    }

    await db.delete(products).where(eq(products.id, productId));

    return json({ message: "Product deleted" });
  });

  // Consume/waste/share/sell product
  router.post("/api/v1/myfridge/products/:id/consume", async (req, params) => {
    try {
      const user = getUser(req);
      const productId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = consumeSchema.parse(body);

      const product = await db.query.products.findFirst({
        where: and(
          eq(products.id, productId),
          eq(products.userId, user.id)
        ),
      });

      if (!product) {
        return error("Product not found", 404);
      }

      // Record the interaction in ProductSustainabilityMetrics table (per ERD)
      await recordProductSustainabilityMetrics(
        product.id,
        user.id,
        product.quantity,
        data.action
      );

      // Award points based on action
      const pointResult = await awardPoints(user.id, data.action);

      // Delete the product from the fridge (consumed items leave the fridge)
      await db.delete(products).where(eq(products.id, productId));

      return json({
        message: `Product marked as ${data.action}`,
        pointsAwarded: pointResult.amount,
        newTotal: pointResult.newTotal,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consume product error:", e);
      return error("Failed to process product", 500);
    }
  });

  // Scan receipt (placeholder)
  router.post("/api/v1/myfridge/receipt/scan", async (req) => {
    try {
      const user = getUser(req);
      return json({
        message: "Receipt scanning is not yet implemented",
        products: [],
      });
    } catch (e) {
      console.error("Scan receipt error:", e);
      return error("Failed to scan receipt", 500);
    }
  });
}
