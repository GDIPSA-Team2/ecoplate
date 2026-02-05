import { Router, json, error } from "../utils/router";
import { getUser } from "../middleware/auth";
import {
  getAllRewards,
  getRewardById,
  createReward,
  updateReward,
  deleteReward,
  getAllRedemptions,
  collectRedemption,
  findRedemptionByCode,
} from "../services/reward-service";

export function registerAdminRewardsRoutes(router: Router) {
  // Get all rewards (including inactive)
  router.get("/api/v1/admin/rewards", async (req) => {
    try {
      getUser(req); // TODO: Add admin check
      const rewards = await getAllRewards();
      return json(rewards);
    } catch (err: any) {
      return error(err.message || "Failed to get rewards", 500);
    }
  });

  // Get single reward
  router.get("/api/v1/admin/rewards/:id", async (req) => {
    try {
      getUser(req);
      const url = new URL(req.url);
      const id = parseInt(url.pathname.split("/").pop() || "0");

      const reward = await getRewardById(id);
      if (!reward) {
        return error("Reward not found", 404);
      }
      return json(reward);
    } catch (err: any) {
      return error(err.message || "Failed to get reward", 500);
    }
  });

  // Create a new reward
  router.post("/api/v1/admin/rewards", async (req) => {
    try {
      getUser(req);
      const body = await req.json();

      const { name, description, imageUrl, category, pointsCost, stock, isActive } = body;

      if (!name || !category || pointsCost === undefined) {
        return error("Name, category, and pointsCost are required", 400);
      }

      const reward = await createReward({
        name,
        description,
        imageUrl,
        category,
        pointsCost,
        stock: stock || 0,
        isActive: isActive ?? true,
      });

      return json(reward);
    } catch (err: any) {
      return error(err.message || "Failed to create reward", 500);
    }
  });

  // Update a reward
  router.put("/api/v1/admin/rewards/:id", async (req) => {
    try {
      getUser(req);
      const url = new URL(req.url);
      const id = parseInt(url.pathname.split("/").pop() || "0");
      const body = await req.json();

      const reward = await updateReward(id, body);
      if (!reward) {
        return error("Reward not found", 404);
      }

      return json(reward);
    } catch (err: any) {
      return error(err.message || "Failed to update reward", 500);
    }
  });

  // Delete a reward
  router.delete("/api/v1/admin/rewards/:id", async (req) => {
    try {
      getUser(req);
      const url = new URL(req.url);
      const id = parseInt(url.pathname.split("/").pop() || "0");

      await deleteReward(id);
      return json({ success: true });
    } catch (err: any) {
      return error(err.message || "Failed to delete reward", 500);
    }
  });

  // Get all redemptions
  router.get("/api/v1/admin/redemptions", async (req) => {
    try {
      getUser(req);
      const redemptions = await getAllRedemptions();
      return json(redemptions);
    } catch (err: any) {
      return error(err.message || "Failed to get redemptions", 500);
    }
  });

  // Find redemption by code
  router.get("/api/v1/admin/redemptions/search", async (req) => {
    try {
      getUser(req);
      const url = new URL(req.url);
      const code = url.searchParams.get("code");

      if (!code) {
        return error("Code is required", 400);
      }

      const redemption = await findRedemptionByCode(code);
      if (!redemption) {
        return error("Redemption not found", 404);
      }

      return json(redemption);
    } catch (err: any) {
      return error(err.message || "Failed to search redemption", 500);
    }
  });

  // Mark redemption as collected
  router.put("/api/v1/admin/redemptions/:id/collect", async (req) => {
    try {
      getUser(req);
      const url = new URL(req.url);
      const pathParts = url.pathname.split("/");
      const id = parseInt(pathParts[pathParts.length - 2] || "0");

      const redemption = await collectRedemption(id);
      if (!redemption) {
        return error("Redemption not found", 404);
      }

      return json(redemption);
    } catch (err: any) {
      return error(err.message || "Failed to collect redemption", 500);
    }
  });
}
