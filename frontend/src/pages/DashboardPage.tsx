import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import { Leaf, Utensils, DollarSign, Star, Car, TreePine, Zap } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  summary: {
    totalCo2Reduced: number;
    totalFoodSaved: number;
    totalMoneySaved: number;
  };
  co2ChartData: Array<{ date: string; value: number }>;
  foodChartData: Array<{ date: string; value: number }>;
  impactEquivalence: {
    carKmAvoided: number;
    treesPlanted: number;
    electricitySaved: number;
  };
}

interface PointsData {
  points: {
    total: number;
    available: number;
    lifetime: number;
    currentStreak: number;
    longestStreak: number;
  };
  stats: {
    pointsToday: number;
    pointsThisWeek: number;
    pointsThisMonth: number;
  };
}

type Tab = "summary" | "co2" | "financial" | "food";
type Period = "day" | "month" | "annual";

const tabs: { key: Tab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "co2", label: "CO₂" },
  { key: "financial", label: "Financial" },
  { key: "food", label: "Food" },
];

const periods: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "annual", label: "Annual" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [activePeriod, setActivePeriod] = useState<Period>("month");
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadStats();
  }, [activePeriod]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [statsResponse, pointsResponse] = await Promise.all([
          api.get<DashboardStats>(`/dashboard/stats?period=${activePeriod}`),
          api.get<PointsData>("/gamification/points"),
      ]);
      setData(statsResponse);
      setPointsData(pointsResponse);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const summary = data?.summary;

  const statCards = [
    {
      label: "Total CO₂ Reduced",
      value: `${summary?.totalCo2Reduced ?? 0} kg`,
      icon: Leaf,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total Food Saved",
      value: `${summary?.totalFoodSaved ?? 0} kg`,
      icon: Utensils,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Total Money Saved",
      value: `$${summary?.totalMoneySaved ?? 0}`,
      icon: DollarSign,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: activePeriod === "day"
        ? "EcoPoints (Today)"
        : activePeriod === "month"
        ? "EcoPoints (Month)"
        : "EcoPoints (Annual)",
      value: `${
        activePeriod === "day"
          ? (pointsData?.stats?.pointsToday ?? 0)
          : activePeriod === "month"
          ? (pointsData?.stats?.pointsThisMonth ?? 0)
          : (pointsData?.points.total ?? 0)
      }`,
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
  ];

  const impactItems = [
    {
      label: "Car km avoided",
      value: data?.impactEquivalence.carKmAvoided ?? 0,
      unit: "km",
      icon: Car,
    },
    {
      label: "Trees planted equivalent",
      value: data?.impactEquivalence.treesPlanted ?? 0,
      unit: "",
      icon: TreePine,
    },
    {
      label: "Electricity saved",
      value: data?.impactEquivalence.electricitySaved ?? 0,
      unit: "kWh",
      icon: Zap,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {getGreeting()}, {user?.name?.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's your sustainability overview
        </p>
      </div>

      {/* Tab buttons + Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex bg-muted rounded-lg sm:rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex bg-muted rounded-lg sm:rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1 self-start sm:self-auto">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePeriod(p.key)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg transition-colors ${
                activePeriod === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      {(activeTab === "summary" || activeTab === "co2" || activeTab === "financial" || activeTab === "food") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="card-hover">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${card.bg} flex-shrink-0`}>
                    <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                      {card.label}
                    </p>
                    <p className="text-base sm:text-xl font-bold truncate">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CO2 Chart */}
      {(activeTab === "summary" || activeTab === "co2") && (
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              CO₂ Reduction Over Time
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.co2ChartData || []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="CO₂ (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Food Chart */}
      {(activeTab === "summary" || activeTab === "food") && (
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Food Saved Over Time
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.foodChartData || []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Food (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial - show money saved chart placeholder on financial tab */}
      {activeTab === "financial" && (
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Money Saved Overview
            </h3>
            <div className="flex items-center justify-center h-48 sm:h-64 text-muted-foreground">
              <div className="text-center">
                <DollarSign className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 text-blue-500/50" />
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  ${summary?.totalMoneySaved ?? 0}
                </p>
                <p className="text-xs sm:text-sm mt-1">Total saved from marketplace sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Equivalence */}
      {activeTab === "summary" && (
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Impact Equivalence</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {impactItems.map((item) => (
                <div
                  key={item.label}
                  className="text-center p-2 sm:p-4 rounded-lg sm:rounded-xl bg-muted/50"
                >
                  <item.icon className="h-5 w-5 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-primary" />
                  <p className="text-sm sm:text-xl font-bold">
                    {item.value}
                    {item.unit && (
                      <span className="text-[10px] sm:text-sm font-normal ml-0.5 sm:ml-1">
                        {item.unit}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
