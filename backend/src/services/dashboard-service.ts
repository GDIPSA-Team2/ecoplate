import { db } from "../index";
import { eq, sql, and, gte } from "drizzle-orm";
import * as schema from "../db/schema";

type Period = "day" | "month" | "annual";

function getDateRange(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30); // last 30 days
    case "month":
      return new Date(now.getFullYear() - 1, now.getMonth(), 1); // last 12 months
    case "annual":
      return new Date(now.getFullYear() - 5, 0, 1); // last 5 years
  }
}

function formatDate(date: Date, period: Period): string {
  switch (period) {
    case "day":
      return date.toISOString().slice(0, 10); // YYYY-MM-DD
    case "month":
      return date.toISOString().slice(0, 7); // YYYY-MM
    case "annual":
      return date.getFullYear().toString();
  }
}

export async function getDashboardStats(userId: number, period: Period = "month") {
  const rangeStart = getDateRange(period);

  // Get sustainability metrics for this user
  const metrics = db
    .select()
    .from(schema.productSustainabilityMetrics)
    .where(
      and(
        eq(schema.productSustainabilityMetrics.userId, userId),
        gte(schema.productSustainabilityMetrics.todayDate, rangeStart)
      )
    )
    .all();

  // Get products for co2 data
  const products = db
    .select()
    .from(schema.products)
    .where(eq(schema.products.userId, userId))
    .all();

  // Get sold listings for money saved
  const soldListings = db
    .select()
    .from(schema.marketplaceListings)
    .where(
      and(
        eq(schema.marketplaceListings.sellerId, userId),
        eq(schema.marketplaceListings.status, "sold")
      )
    )
    .all();

  // Calculate summary stats
  const consumedOrSold = metrics.filter(
    (m) => m.type === "consumed" || m.type === "sold"
  );

  // CO2 from products linked to consumed/sold metrics
  let totalCo2Reduced = 0;
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const m of consumedOrSold) {
    const product = productMap.get(m.productId);
    if (product?.co2Emission) {
      totalCo2Reduced += product.co2Emission;
    }
  }

  const totalFoodSaved = consumedOrSold.reduce((sum, m) => sum + m.quantity, 0);
  const totalMoneySaved = soldListings.reduce((sum, l) => sum + (l.price || 0), 0);
  const ecoPointsEarned = consumedOrSold.length * 10 + soldListings.length * 25;

  // Build chart data grouped by period
  const co2Map = new Map<string, number>();
  const foodMap = new Map<string, number>();

  for (const m of consumedOrSold) {
    const dateKey = formatDate(m.todayDate, period);
    const product = productMap.get(m.productId);
    const co2 = product?.co2Emission || 0;

    co2Map.set(dateKey, (co2Map.get(dateKey) || 0) + co2);
    foodMap.set(dateKey, (foodMap.get(dateKey) || 0) + m.quantity);
  }

  const co2ChartData = Array.from(co2Map.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const foodChartData = Array.from(foodMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Impact equivalence
  const impactEquivalence = {
    carKmAvoided: Math.round(totalCo2Reduced * 6.0 * 10) / 10,
    treesPlanted: Math.round((totalCo2Reduced / 21.0) * 10) / 10,
    electricitySaved: Math.round(totalCo2Reduced * 3.6 * 10) / 10,
  };

  return {
    summary: {
      totalCo2Reduced: Math.round(totalCo2Reduced * 100) / 100,
      totalFoodSaved: Math.round(totalFoodSaved * 100) / 100,
      totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
      ecoPointsEarned,
    },
    co2ChartData,
    foodChartData,
    impactEquivalence,
  };
}
