import { db } from "../index";
import { rewards, userRedemptions, userPoints } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// Generate a unique redemption code
function generateRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "EP-"; // EcoPoints prefix
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all available rewards (active and in stock)
export async function getAvailableRewards() {
  return db
    .select()
    .from(rewards)
    .where(eq(rewards.isActive, true))
    .orderBy(rewards.pointsCost);
}

// Get all rewards (for admin)
export async function getAllRewards() {
  return db.select().from(rewards).orderBy(desc(rewards.createdAt));
}

// Get a single reward by ID
export async function getRewardById(rewardId: number) {
  const result = await db
    .select()
    .from(rewards)
    .where(eq(rewards.id, rewardId))
    .limit(1);
  return result[0] || null;
}

// Create a new reward (admin)
export async function createReward(data: {
  name: string;
  description?: string;
  imageUrl?: string;
  category: string;
  pointsCost: number;
  stock: number;
  isActive?: boolean;
}) {
  const now = new Date();
  const result = await db
    .insert(rewards)
    .values({
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      category: data.category,
      pointsCost: data.pointsCost,
      stock: data.stock,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return result[0];
}

// Update a reward (admin)
export async function updateReward(
  rewardId: number,
  data: Partial<{
    name: string;
    description: string;
    imageUrl: string;
    category: string;
    pointsCost: number;
    stock: number;
    isActive: boolean;
  }>
) {
  const result = await db
    .update(rewards)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(rewards.id, rewardId))
    .returning();
  return result[0] || null;
}

// Delete a reward (admin)
export async function deleteReward(rewardId: number) {
  await db.delete(rewards).where(eq(rewards.id, rewardId));
}

// Redeem a reward
export async function redeemReward(userId: number, rewardId: number) {
  // Get the reward
  const reward = await getRewardById(rewardId);
  if (!reward) {
    throw new Error("Reward not found");
  }

  if (!reward.isActive) {
    throw new Error("This reward is no longer available");
  }

  if (reward.stock <= 0) {
    throw new Error("This reward is out of stock");
  }

  // Get user's current points
  const userPointsResult = await db
    .select()
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);

  const currentPoints = userPointsResult[0]?.totalPoints || 0;

  if (currentPoints < reward.pointsCost) {
    throw new Error(
      `Insufficient points. You need ${reward.pointsCost} points but only have ${currentPoints}`
    );
  }

  // Generate unique redemption code
  let redemptionCode = generateRedemptionCode();

  // Ensure code is unique (retry if collision)
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db
      .select()
      .from(userRedemptions)
      .where(eq(userRedemptions.redemptionCode, redemptionCode))
      .limit(1);

    if (existing.length === 0) break;
    redemptionCode = generateRedemptionCode();
    attempts++;
  }

  // Set expiry date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Create redemption record
  const redemption = await db
    .insert(userRedemptions)
    .values({
      userId,
      rewardId,
      pointsSpent: reward.pointsCost,
      redemptionCode,
      status: "pending",
      expiresAt,
      createdAt: new Date(),
    })
    .returning();

  // Deduct points from user
  await db
    .update(userPoints)
    .set({
      totalPoints: sql`${userPoints.totalPoints} - ${reward.pointsCost}`,
    })
    .where(eq(userPoints.userId, userId));

  // Decrease stock
  await db
    .update(rewards)
    .set({
      stock: sql`${rewards.stock} - 1`,
      updatedAt: new Date(),
    })
    .where(eq(rewards.id, rewardId));

  return {
    ...redemption[0],
    reward,
  };
}

// Get user's redemption history
export async function getUserRedemptions(userId: number) {
  const result = await db
    .select({
      id: userRedemptions.id,
      pointsSpent: userRedemptions.pointsSpent,
      redemptionCode: userRedemptions.redemptionCode,
      status: userRedemptions.status,
      collectedAt: userRedemptions.collectedAt,
      expiresAt: userRedemptions.expiresAt,
      createdAt: userRedemptions.createdAt,
      reward: {
        id: rewards.id,
        name: rewards.name,
        description: rewards.description,
        imageUrl: rewards.imageUrl,
        category: rewards.category,
        pointsCost: rewards.pointsCost,
      },
    })
    .from(userRedemptions)
    .innerJoin(rewards, eq(userRedemptions.rewardId, rewards.id))
    .where(eq(userRedemptions.userId, userId))
    .orderBy(desc(userRedemptions.createdAt));

  return result;
}

// Get all redemptions (admin)
export async function getAllRedemptions(filters?: {
  status?: string;
  userId?: number;
}) {
  let query = db
    .select({
      id: userRedemptions.id,
      userId: userRedemptions.userId,
      pointsSpent: userRedemptions.pointsSpent,
      redemptionCode: userRedemptions.redemptionCode,
      status: userRedemptions.status,
      collectedAt: userRedemptions.collectedAt,
      expiresAt: userRedemptions.expiresAt,
      createdAt: userRedemptions.createdAt,
      reward: {
        id: rewards.id,
        name: rewards.name,
        category: rewards.category,
        pointsCost: rewards.pointsCost,
      },
    })
    .from(userRedemptions)
    .innerJoin(rewards, eq(userRedemptions.rewardId, rewards.id))
    .orderBy(desc(userRedemptions.createdAt));

  // Note: filters would need additional where clauses
  // For now returning all
  return query;
}

// Mark redemption as collected (admin)
export async function collectRedemption(redemptionId: number) {
  const result = await db
    .update(userRedemptions)
    .set({
      status: "collected",
      collectedAt: new Date(),
    })
    .where(eq(userRedemptions.id, redemptionId))
    .returning();

  return result[0] || null;
}

// Find redemption by code (for admin lookup)
export async function findRedemptionByCode(code: string) {
  const result = await db
    .select({
      id: userRedemptions.id,
      userId: userRedemptions.userId,
      pointsSpent: userRedemptions.pointsSpent,
      redemptionCode: userRedemptions.redemptionCode,
      status: userRedemptions.status,
      collectedAt: userRedemptions.collectedAt,
      expiresAt: userRedemptions.expiresAt,
      createdAt: userRedemptions.createdAt,
      reward: {
        id: rewards.id,
        name: rewards.name,
        description: rewards.description,
        imageUrl: rewards.imageUrl,
        category: rewards.category,
        pointsCost: rewards.pointsCost,
      },
    })
    .from(userRedemptions)
    .innerJoin(rewards, eq(userRedemptions.rewardId, rewards.id))
    .where(eq(userRedemptions.redemptionCode, code.toUpperCase()))
    .limit(1);

  return result[0] || null;
}

// Get user's current points balance
export async function getUserPointsBalance(userId: number) {
  const result = await db
    .select({ totalPoints: userPoints.totalPoints })
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);

  return result[0]?.totalPoints || 0;
}
