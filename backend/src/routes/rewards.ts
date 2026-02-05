import { Router, json, error } from "../utils/router";
import { getUser } from "../middleware/auth";
import {
  getAvailableRewards,
  redeemReward,
  getUserRedemptions,
  getUserPointsBalance,
} from "../services/reward-service";

export function registerRewardsRoutes(router: Router) {
  // Get all available rewards
  router.get("/api/v1/rewards", async (req) => {
    try {
      getUser(req); // Ensure authenticated
      const rewards = await getAvailableRewards();
      return json(rewards);
    } catch (err: any) {
      return error(err.message || "Failed to get rewards", 500);
    }
  });

  // Get user's current points balance
  router.get("/api/v1/rewards/balance", async (req) => {
    try {
      const user = getUser(req);
      const balance = await getUserPointsBalance(user.id);
      return json({ balance });
    } catch (err: any) {
      return error(err.message || "Failed to get balance", 500);
    }
  });

  // Redeem a reward
  router.post("/api/v1/rewards/redeem", async (req) => {
    try {
      const user = getUser(req);
      const body = await req.json();
      const { rewardId } = body;

      if (!rewardId) {
        return error("Reward ID is required", 400);
      }

      const redemption = await redeemReward(user.id, rewardId);
      return json(redemption);
    } catch (err: any) {
      // Check for specific error types
      if (err.message.includes("Insufficient points")) {
        return error(err.message, 400);
      }
      if (err.message.includes("out of stock")) {
        return error(err.message, 400);
      }
      if (err.message.includes("not found")) {
        return error(err.message, 404);
      }
      if (err.message.includes("no longer available")) {
        return error(err.message, 400);
      }
      return error(err.message || "Failed to redeem reward", 500);
    }
  });

  // Get user's redemption history
  router.get("/api/v1/rewards/my-redemptions", async (req) => {
    try {
      const user = getUser(req);
      const redemptions = await getUserRedemptions(user.id);
      return json(redemptions);
    } catch (err: any) {
      return error(err.message || "Failed to get redemptions", 500);
    }
  });
}
