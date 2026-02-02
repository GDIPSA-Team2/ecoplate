import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Trophy,
  Leaf,
  TrendingUp,
  Flame,
  Users,
  Check,
  X,
  Share,
  DollarSign,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ACTION_CONFIG, INITIAL_TX_COUNT } from "../constants/gamification";

interface PointsData {
  points: {
    total: number;
    available: number;
    lifetime: number;
    currentStreak: number;
    longestStreak: number;
  };
  stats: {
    totalActiveDays: number;
    lastActiveDate: string | null;
    firstActivityDate: string | null;
    pointsToday: number;
    pointsThisWeek: number;
    pointsThisMonth: number;
    bestDayPoints: number;
    averagePointsPerActiveDay: number;
  };
  breakdown: Record<string, { count: number; totalPoints: number }>;
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    action: string;
    createdAt: string;
  }>;
}

interface MetricsData {
  totalItemsConsumed: number;
  totalItemsWasted: number;
  totalItemsShared: number;
  totalItemsSold: number;
  estimatedMoneySaved: number;
  estimatedCo2Saved: number;
  wasteReductionRate: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  points: number;
  streak: number;
}

export default function EcoBoardPage() {
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTx, setShowAllTx] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [points, metricsData, leaderboardData] = await Promise.all([
        api.get<PointsData>("/gamification/points"),
        api.get<MetricsData>("/gamification/metrics"),
        api.get<LeaderboardEntry[]>("/gamification/leaderboard"),
      ]);
      setPointsData(points);
      setMetrics(metricsData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Failed to load gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-60 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const breakdown = pointsData?.breakdown || {};
  const transactions = pointsData?.transactions || [];
  const visibleTx = showAllTx ? transactions : transactions.slice(0, INITIAL_TX_COUNT);

  const pieData = Object.entries(ACTION_CONFIG)
    .filter(([action]) => (breakdown[action]?.count || 0) > 0)
    .map(([action, config]) => ({
      name: config.label,
      value: breakdown[action]?.totalPoints || 0,
      count: breakdown[action]?.count || 0,
      color: config.chartColor,
      action,
    }));

  const totalPoints = pieData.reduce((sum, d) => sum + Math.abs(d.value), 0);
  const hasPieData = pieData.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">EcoBoard</h1>
        <p className="text-muted-foreground">Track your sustainability journey</p>
      </div>

      {/* 2x2 Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Points & Streak */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              Eco Points
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary">
                {pointsData?.points.total || 0}
              </div>
              <p className="text-muted-foreground">Total Points</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-warning">
                  <Flame className="h-5 w-5" />
                  <span className="text-2xl font-bold">
                    {pointsData?.points.currentStreak || 0}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Day Streak</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl">
                <div className="text-2xl font-bold text-foreground">
                  {pointsData?.points.longestStreak || 0}
                </div>
                <p className="text-sm text-muted-foreground">Best Streak</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Lifetime Points</span>
                <span className="font-medium">
                  {pointsData?.points.lifetime || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Available Points</span>
                <span className="font-medium">
                  {pointsData?.points.available || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 2: Points Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="h-5 w-5 text-primary" />
              Points Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasPieData ? (
              <div className="flex flex-col lg:flex-row items-center gap-6">
                {/* Pie Chart */}
                <div className="w-full lg:w-1/2 h-[200px] sm:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        dataKey="value"
                        label={(props: { name?: string; percent?: number }) =>
                          `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [
                          `${Math.abs(Number(value) || 0)} pts`,
                          String(name ?? ""),
                        ]}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Breakdown List */}
                <div className="w-full lg:w-1/2 space-y-3">
                  {pieData.map((entry) => {
                    const pct =
                      totalPoints > 0
                        ? ((Math.abs(entry.value) / totalPoints) * 100).toFixed(1)
                        : "0";
                    const config = ACTION_CONFIG[entry.action];
                    const Icon = config?.icon || Check;

                    return (
                      <div key={entry.name} className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `color-mix(in srgb, ${entry.color} 15%, transparent)` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: entry.color }} />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground text-sm">
                              {entry.name}
                            </span>
                            <span
                              className="font-bold text-sm"
                              style={{ color: entry.color }}
                            >
                              {entry.value > 0 ? "+" : ""}
                              {entry.value} pts
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: entry.color,
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pct}% &middot; {entry.count} items
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Leaf className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  No activity yet. Start earning points!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel 3: Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-success/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-success" />
                  <span>Consumed</span>
                </div>
                <span className="text-xl font-bold text-success">
                  {metrics?.totalItemsConsumed || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <Share className="h-5 w-5 text-primary" />
                  <span>Shared</span>
                </div>
                <span className="text-xl font-bold text-primary">
                  {metrics?.totalItemsShared || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-accent/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-accent" />
                  <span>Sold</span>
                </div>
                <span className="text-xl font-bold text-accent">
                  {metrics?.totalItemsSold || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span>Wasted</span>
                </div>
                <span className="text-xl font-bold text-destructive">
                  {metrics?.totalItemsWasted || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 4: Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No leaderboard data yet
              </p>
            ) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map((entry) => (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1
                          ? "bg-warning/20 text-warning"
                          : entry.rank === 2
                          ? "bg-muted text-muted-foreground"
                          : entry.rank === 3
                          ? "bg-secondary/20 text-secondary"
                          : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {entry.rank}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.streak} day streak
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{entry.points}</p>
                      <p className="text-xs text-muted-foreground">points</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Points History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Points History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {visibleTx.map((tx) => {
                const config = ACTION_CONFIG[tx.action];
                const Icon = config?.icon || Check;
                const color = config?.color || "text-muted-foreground";
                const bgColor = config?.bgColor || "bg-muted";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bgColor}`}
                    >
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm capitalize text-foreground truncate">
                        {tx.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={tx.amount > 0 ? "success" : "destructive"}
                      className="text-sm"
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount} pts
                    </Badge>
                  </div>
                );
              })}
              {transactions.length > INITIAL_TX_COUNT && (
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => setShowAllTx(!showAllTx)}
                >
                  {showAllTx ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show All ({transactions.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to Earn More Points */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-warning" />
            How to Earn More Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(ACTION_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={key}
                  className={`p-3 sm:p-4 rounded-xl ${config.bgColor}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-sm">
                        {config.label}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.description}
                      </p>
                      <p className={`font-bold text-sm mt-2 ${config.color}`}>
                        {config.points > 0 ? "+" : ""}
                        {config.points} pts per item
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
