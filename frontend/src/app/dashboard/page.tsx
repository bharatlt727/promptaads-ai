"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  MousePointerClick,
  Eye,
  FileText,
  Plus,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { adsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Ad } from "@/types";

// Generate demo chart data
function generateChartData() {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      name: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      impressions: Math.floor(Math.random() * 500 + 100),
      clicks: Math.floor(Math.random() * 50 + 5),
    });
  }
  return data;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData] = useState(generateChartData);

  useEffect(() => {
    if (!token) return;
    adsApi
      .list(token)
      .then(setAds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const totalAds = ads.length;
  const activeAds = ads.filter((a) => a.status === "active").length;
  const totalImpressions = chartData.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = chartData.reduce((s, d) => s + d.clicks, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const metrics = [
    {
      title: "Total Ads",
      value: totalAds.toString(),
      sub: `${activeAds} active`,
      icon: FileText,
      color: "text-blue-500",
    },
    {
      title: "Impressions",
      value: totalImpressions.toLocaleString(),
      sub: "Last 30 days",
      icon: Eye,
      color: "text-purple-500",
    },
    {
      title: "Clicks",
      value: totalClicks.toLocaleString(),
      sub: "Last 30 days",
      icon: MousePointerClick,
      color: "text-green-500",
    },
    {
      title: "CTR",
      value: `${ctr.toFixed(1)}%`,
      sub: "Avg click-through",
      icon: TrendingUp,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your advertising performance
          </p>
        </div>
        <Link href="/dashboard/ads/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Ad
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{m.title}</CardTitle>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
              <p className="text-xs text-muted-foreground">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Impressions &amp; Clicks</CardTitle>
          <CardDescription>Daily performance over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="hsl(262, 83%, 58%)"
                  fill="url(#fillImpressions)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="hsl(142, 76%, 36%)"
                  fill="url(#fillClicks)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Ads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Ads</CardTitle>
            <CardDescription>Your latest ad creatives</CardDescription>
          </div>
          <Link href="/dashboard/ads">
            <Button variant="ghost" size="sm">
              View all
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : ads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium">No ads yet</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Create your first ad to start reaching users
              </p>
              <Link href="/dashboard/ads/new">
                <Button size="sm">
                  <Plus className="mr-1 h-3 w-3" />
                  Create Ad
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {ads.slice(0, 5).map((ad) => (
                <div
                  key={ad.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ad.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ad.description}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ad.status === "active"
                        ? "success"
                        : ad.status === "paused"
                        ? "warning"
                        : "secondary"
                    }
                    className="ml-3 shrink-0"
                  >
                    {ad.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
