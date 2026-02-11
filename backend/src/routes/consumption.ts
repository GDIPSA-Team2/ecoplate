import { Router, json, error, parseBody } from "../utils/router";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import { identifyIngredients, analyzeWaste } from "../services/image-analysis-service";
import { confirmIngredients, confirmWaste } from "../services/consumption-service";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema";

// ==================== Validation Schemas ====================

const MAX_BASE64_SIZE = 7 * 1024 * 1024;

const identifySchema = z.object({
  imageBase64: z.string().min(1, "Image is required").max(MAX_BASE64_SIZE, "Image too large (max 5MB)"),
});

const ingredientSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1).max(200),
  quantityUsed: z.number().positive().max(10000),
  unit: z.string().nullable().optional(),
  category: z.string().max(50),
  unitPrice: z.number().min(0).max(100000),
  co2Emission: z.number().min(0).max(10000).optional(),
});

const analyzeWasteSchema = z.object({
  imageBase64: z.string().min(1, "Image is required").max(MAX_BASE64_SIZE, "Image too large (max 5MB)"),
  ingredients: z.array(ingredientSchema).max(50, "Too many ingredients"),
});

const confirmIngredientsSchema = z.object({
  ingredients: z.array(ingredientSchema).min(1, "Ingredients are required").max(50, "Too many ingredients"),
  pendingRecordId: z.number().int().positive().optional(),
});

const wasteItemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1).max(200),
  quantityWasted: z.number().min(0).max(10000),
});

const confirmWasteSchema = z.object({
  ingredients: z.array(ingredientSchema.extend({
    interactionId: z.number().int().positive().optional(),
  })).max(50, "Too many ingredients"),
  wasteItems: z.array(wasteItemSchema).max(50, "Too many waste items"),
  pendingRecordId: z.number().int().positive().optional(),
});

// ==================== Route Registration ====================

export function registerConsumptionRoutes(
  router: Router,
  db: BunSQLiteDatabase<typeof schema>
) {

  router.post("/api/v1/consumption/identify", async (req) => {
    console.log("[consumption/identify] Endpoint called");
    try {
      const user = getUser(req);
      console.log("[consumption/identify] User:", user.id);

      const body = await parseBody<{ imageBase64?: string }>(req);
      const parsed = identifySchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const result = await identifyIngredients(db, user.id, parsed.data.imageBase64);
      return json(result);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      const err = e as { status?: number; message?: string; code?: string; type?: string };
      console.error("[consumption/identify] ERROR:", {
        message: err.message,
        status: err.status,
        code: err.code,
        type: err.type,
        fullError: e,
      });
      if (err.message === "OpenAI API key not configured") {
        return error(err.message, 500);
      }
      return error("Failed to identify ingredients", 500);
    }
  });

  router.post("/api/v1/consumption/analyze-waste", async (req) => {
    try {
      getUser(req);
      const body = await parseBody(req);

      const parsed = analyzeWasteSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const { imageBase64, ingredients } = parsed.data;
      const result = await analyzeWaste(imageBase64, ingredients);
      return json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consumption analyze-waste error:", e);
      return error("Failed to analyze waste", 500);
    }
  });

  router.post("/api/v1/consumption/confirm-ingredients", async (req) => {
    console.log("[confirm-ingredients] Endpoint called");
    try {
      const user = getUser(req);
      const body = await parseBody<{ ingredients?: unknown[]; pendingRecordId?: number }>(req);

      const parsed = confirmIngredientsSchema.safeParse(body);
      if (!parsed.success) {
        console.error("[confirm-ingredients] Validation failed:", parsed.error.errors);
        return error(parsed.error.errors[0].message, 400);
      }

      const { ingredients, pendingRecordId } = parsed.data;
      const result = await confirmIngredients(db, user.id, ingredients, pendingRecordId);

      console.log("[confirm-ingredients] Success! interactionIds:", result.interactionIds);
      return json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("[confirm-ingredients] Error:", e instanceof Error ? e.message : e);
      return error("Failed to confirm ingredients", 500);
    }
  });

  router.post("/api/v1/consumption/confirm-waste", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const parsed = confirmWasteSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const { ingredients, wasteItems, pendingRecordId } = parsed.data;
      const result = await confirmWaste(db, user.id, ingredients, wasteItems, pendingRecordId);
      return json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consumption confirm-waste error:", e);
      return error("Failed to confirm waste", 500);
    }
  });
}
