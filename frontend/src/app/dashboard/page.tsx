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
  MousePointerClick,
  Eye,
  FileText,
  Plus,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
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
      gradient: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-500/10",
      textColor: "text-blue-400",
    },
    {
      title: "Impressions",
      value: totalImpressions.toLocaleString(),
      sub: "Last 30 days",
      icon: Eye,
      gradient: "from-purple-500 to-violet-600",
      bgLight: "bg-purple-500/10",
      textColor: "text-purple-400",
    },
    {
      title: "Clicks",
      value: totalClicks.toLocaleString(),
      sub: "Last 30 days",
      icon: MousePointerClick,
      gradient: "from-emerald-500 to-teal-600",
      bgLight: "bg-emerald-500/10",
      textColor: "text-emerald-400",
    },
    {
      title: "CTR",
      value: `${ctr.toFixed(1)}%`,
      sub: "Avg click-through",
      icon: TrendingUp,
      gradient: "from-orange-500 to-amber-600",
      bgLight: "bg-amber-500/10",
      textColor: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your advertising performance
          </p>
        </div>
        <Link href="/dashboard/ads/new">
          <Button className="rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity shadow-md shadow-primary/20 gap-2">
            <Plus className="h-4 w-4" />
            New Ad
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.title} className="stat-card border-0 bg-card overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium text-muted-foreground">{m.title}</span>
                <div className={`w-9 h-9 rounded-xl ${m.bgLight} flex items-center justify-center`}>
                  <m.icon className={`h-4 w-4 ${m.textColor}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight">{m.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="border-0 bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Performance Overview</CardTitle>
              <CardDescription className="text-xs">Daily impressions &amp; clicks over the last 30 days</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-muted-foreground">Impressions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Clicks</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    color: "hsl(var(--foreground))",
                    fontSize: "12px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="hsl(239, 84%, 67%)"
                  fill="url(#fillImpressions)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="hsl(160, 84%, 39%)"
                  fill="url(#fillClicks)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Ads */}
      <Card className="border-0 bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Recent Ads</CardTitle>
            <CardDescription className="text-xs">Your latest ad creatives</CardDescription>
          </div>
          <Link href="/dashboard/ads">
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-primary">
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : ads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No ads yet</p>
              <p className="text-xs text-muted-foreground mb-5 max-w-[260px]">
                Create your first ad and the AI engine will match it to relevant user conversations.
              </p>
              <Link href="/dashboard/ads/new">
                <Button size="sm" className="rounded-xl gradient-primary text-white hover:opacity-90 gap-1.5">
                  <Plus className="h-3 w-3" />
                  Create Ad
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {ads.slice(0, 5).map((ad) => (
                <div
                  key={ad.id}
                  className="flex items-center justify-between rounded-xl p-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {ad.image_url && (
                        <img src={ad.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{ad.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{ad.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-xs text-muted-foreground">${ad.bid_amount?.toFixed(2)}</span>
                    <Badge
                      variant={
                        ad.status === "active"
                          ? "success"
                          : ad.status === "paused"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {ad.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
