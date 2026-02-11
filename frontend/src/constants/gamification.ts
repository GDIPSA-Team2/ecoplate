import { DollarSign, Gift } from "lucide-react";

export const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof DollarSign;
    points: number;
    color: string;
    bgColor: string;
    chartColor: string;
    description: string;
  }
> = {
  sold: {
    label: "Sold",
    icon: DollarSign,
    points: 0,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    chartColor: "hsl(var(--secondary))",
    description: "Sell on the marketplace to earn points.",
  },
  redeemed: {
    label: "Redeemed",
    icon: Gift,
    points: 0,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    chartColor: "hsl(270, 60%, 55%)",
    description: "Spend your points on vouchers and rewards in the Rewards store.",
  },
};

export type ActionConfigType = typeof ACTION_CONFIG;

export const INITIAL_TX_COUNT = 10;
