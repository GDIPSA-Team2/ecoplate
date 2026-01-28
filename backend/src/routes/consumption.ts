import { Router, json, error, parseBody } from "../utils/router";
import { products } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import OpenAI from "openai";
import {
  calculateWasteMetrics,
  recordConsumptionInteractions,
  type IngredientInput,
} from "../services/consumption-service";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema";

// ==================== Validation Schemas ====================

const identifySchema = z.object({
  imageBase64: z.string().min(1, "Image is required"),
});

const ingredientSchema = z.object({
  productId: z.number(),
  productName: z.string(),
  quantityUsed: z.number().positive(),
  category: z.string(),
  unitPrice: z.number(),
  co2Emission: z.number().optional(),
});

const analyzeWasteSchema = z.object({
  imageBase64: z.string().min(1, "Image is required"),
  ingredients: z.array(ingredientSchema).min(1, "Ingredients are required"),
  disposalMethod: z.string().default("landfill"),
});

// ==================== Route Registration ====================

export function registerConsumptionRoutes(
  router: Router,
  db: BunSQLiteDatabase<typeof schema>
) {

  // API 1: Identify ingredients from a photo of raw food
  router.post("/api/v1/consumption/identify", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const parsed = identifySchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const { imageBase64 } = parsed.data;

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return error("OpenAI API key not configured", 500);
      }

      // Get user's unconsumed fridge products
      const fridgeProducts = await db.query.products.findMany({
        where: and(
          eq(products.userId, user.id),
          eq(products.isConsumed, false)
        ),
      });

      const fridgeList = fridgeProducts.map((p) => ({
        id: p.id,
        name: p.productName,
        category: p.category,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        co2Emission: p.co2Emission,
      }));

      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a food identification assistant. Analyze this image of raw ingredients being prepared for cooking. identify and match them to the user's fridge inventory below.

Fridge inventory:
${JSON.stringify(fridgeList, null, 2)}

For each visible ingredient, match it to the closest fridge item by product ID. Estimate the quantity being used (as a fraction of the fridge item's total quantity). Rate your confidence as "high", "medium", or "low".

Return JSON with this structure:
{
  "ingredients": [
    {
      "productId": <number - matched fridge product ID>,
      "name": "<ingredient name as seen>",
      "matchedProductName": "<fridge product name>",
      "estimatedQuantity": <number - fraction of total quantity being used>,
      "category": "<food category>",
      "unitPrice": <number - from fridge data>,
      "co2Emission": <number - from fridge data>,
      "confidence": "high" | "medium" | "low"
    }
  ]
}

If an ingredient is not in the fridge, omit the productId and provide your best estimate for the other fields.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "identified_ingredients",
            strict: true,
            schema: {
              type: "object",
              properties: {
                ingredients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      productId: { type: "number" },
                      name: { type: "string" },
                      matchedProductName: { type: "string" },
                      estimatedQuantity: { type: "number" },
                      category: { type: "string" },
                      unitPrice: { type: "number" },
                      co2Emission: { type: "number" },
                      confidence: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                      },
                    },
                    required: [
                      "productId",
                      "name",
                      "matchedProductName",
                      "estimatedQuantity",
                      "category",
                      "unitPrice",
                      "co2Emission",
                      "confidence",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["ingredients"],
              additionalProperties: false,
            },
          },
        },
      });

      const content =
        response.choices[0]?.message?.content || '{"ingredients":[]}';
      const parsed_response = JSON.parse(content);

      return json({ ingredients: parsed_response.ingredients });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consumption identify error:", e);
      return error("Failed to identify ingredients", 500);
    }
  });

  // API 2: Analyze waste from a photo of leftover food
  router.post("/api/v1/consumption/analyze-waste", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const parsed = analyzeWasteSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const { imageBase64, ingredients, disposalMethod } = parsed.data;

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return error("OpenAI API key not configured", 500);
      }

      const openai = new OpenAI({ apiKey });

      // Ask OpenAI to identify waste from the image
      const ingredientList = ingredients.map((i) => ({
        productId: i.productId,
        name: i.productName,
        quantityUsed: i.quantityUsed,
        category: i.category,
      }));

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image of food waste/leftovers after a meal. The following ingredients were used in cooking:

${JSON.stringify(ingredientList, null, 2)}

For each ingredient that appears as waste in the image, estimate the quantity wasted (in the same units as quantityUsed). If an ingredient has no visible waste, do not include it.

Return JSON:
{
  "wasteItems": [
    {
      "productName": "<ingredient name>",
      "quantityWasted": <number>,
      "productId": <number from the ingredient list>
    }
  ],
  "overallObservation": "<brief description of waste level>"
}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "waste_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                wasteItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      productName: { type: "string" },
                      quantityWasted: { type: "number" },
                      productId: { type: "number" },
                    },
                    required: [
                      "productName",
                      "quantityWasted",
                      "productId",
                    ],
                    additionalProperties: false,
                  },
                },
                overallObservation: { type: "string" },
              },
              required: ["wasteItems", "overallObservation"],
              additionalProperties: false,
            },
          },
        },
      });

      const content =
        response.choices[0]?.message?.content ||
        '{"wasteItems":[],"overallObservation":"Unable to analyze"}';
      const wasteAnalysis = JSON.parse(content);

      // Calculate metrics
      const ingredientInputs: IngredientInput[] = ingredients.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantityUsed: i.quantityUsed,
        category: i.category,
        unitPrice: i.unitPrice,
        co2Emission: i.co2Emission,
      }));

      const metrics = calculateWasteMetrics(
        ingredientInputs,
        wasteAnalysis.wasteItems,
        disposalMethod
      );

      // Record interactions in the database
      const interactions = await recordConsumptionInteractions(
        db,
        user.id,
        ingredientInputs,
        wasteAnalysis.wasteItems
      );

      return json({
        metrics,
        wasteAnalysis,
        interactions,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consumption analyze-waste error:", e);
      return error("Failed to analyze waste", 500);
    }
  });
}
