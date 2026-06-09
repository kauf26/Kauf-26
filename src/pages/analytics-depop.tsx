import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  Package,
  RefreshCw,
  Shirt,
  TrendingUp,
  Wallet,
} from "lucide-react";

const DEPOP_COLOR = "#ff2300";

type DepopAnalytics = {
  marketplaceId: string;
  configured: boolean;
  partnershipStatus: string;
  generatedAt: string;
  summary: {
    totalListings: number;
    activeListings: number;
    totalSales: number;
    grossRevenue: number;
    netRevenue: number;
    platformFees: number;
    avgSalePrice: number;
    publishSuccessRate: number;
    inventorySynced: number;
  };
  listingsByStatus: Array<{ status: string; count: number }>;
  salesByDay: Array<{ date: string; sales: number; revenue: number }>;
  publishTasksByStatus: Array<{ status: string; count: number }>;
  recentSales: Array<{
    id: number;
    saleAmount: string;
    saleCurrency: string;
    saleDate: string;
    listingTitle: string;
  }>;
  recentPublishTasks: Array<{
    id: number;
    status: string | null;
    errorMessage: string | null;
    updatedAt: string | null;
  }>;
  recentSyncEvents: Array<{
    id: number;
    eventType: string;
    message: string;
    createdAt: string | null;
  }>;
};

const salesChartConfig = {
  revenue: { label: "Revenue", color: DEPOP_COLOR },
  sales: { label: "Sales", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const listingChartConfig = {
  count: { label: "Listings", color: DEPOP_COLOR },
} satisfies ChartConfig;

const STATUS_COLORS = [
  DEPOP_COLOR,
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DepopAnalyticsPage() {
  const { data, isLoading, isError, refetch, isFetching } =
    useQuery<DepopAnalytics>({
      queryKey: ["analytics", "depop"],
      queryFn: async () => {
        const res = await fetch("/api/analytics/depop");
        if (!res.ok) throw new Error("Failed to load Depop analytics");
        return res.json();
      },
      refetchInterval: 60_000,
    });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto max-w-4xl py-16 text-center">
        <p className="mb-4 text-muted-foreground">
          Could not load Depop analytics.
        </p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const listingPieData =
    data.listingsByStatus.length > 0
      ? data.listingsByStatus
      : [{ status: "none", count: 1 }];

  const publishBarData =
    data.publishTasksByStatus.length > 0
      ? data.publishTasksByStatus
      : [{ status: "no tasks", count: 0 }];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: DEPOP_COLOR }}
              >
                <Shirt className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Depop Analytics
                </h1>
                <p className="text-muted-foreground">
                  Listings, sales, publish jobs, and inventory sync for Depop
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={data.configured ? "default" : "secondary"}>
                {data.configured ? "API key configured" : "API key missing"}
              </Badge>
              <Badge variant="outline">{data.partnershipStatus}</Badge>
              <span className="text-xs text-muted-foreground self-center">
                Updated {formatShortDate(data.generatedAt)}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Gross revenue"
            value={formatCurrency(data.summary.grossRevenue)}
            subtitle={`${data.summary.totalSales} sales`}
            icon={<Wallet className="h-5 w-5" />}
          />
          <SummaryCard
            title="Active listings"
            value={String(data.summary.activeListings)}
            subtitle={`${data.summary.totalListings} total`}
            icon={<Package className="h-5 w-5" />}
          />
          <SummaryCard
            title="Avg sale price"
            value={formatCurrency(data.summary.avgSalePrice)}
            subtitle="Per completed sale"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <SummaryCard
            title="Publish success"
            value={`${data.summary.publishSuccessRate.toFixed(0)}%`}
            subtitle={`${data.summary.inventorySynced} inventory synced`}
            icon={<BarChart3 className="h-5 w-5" />}
          />
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue (last 30 days)</CardTitle>
              <CardDescription>Daily Depop sales and revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={salesChartConfig} className="h-[280px] w-full">
                <AreaChart data={data.salesByDay} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatShortDate}
                    minTickGap={24}
                  />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={DEPOP_COLOR}
                    fill={DEPOP_COLOR}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listings by status</CardTitle>
              <CardDescription>Current Depop listing breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {data.listingsByStatus.length === 0 ? (
                <EmptyChart message="No Depop listings yet" />
              ) : (
                <ChartContainer config={listingChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={listingPieData}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {listingPieData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Publish tasks</CardTitle>
              <CardDescription>Status of Depop publish jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={listingChartConfig} className="h-[220px] w-full">
                <BarChart data={publishBarData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill={DEPOP_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent sales</CardTitle>
              <CardDescription>Latest Depop transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentSales.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No Depop sales recorded yet. Publish listings to Depop to start
                  tracking revenue here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.recentSales.map((sale) => (
                    <li
                      key={sale.id}
                      className="flex items-center justify-between gap-3 border-b pb-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{sale.listingTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(sale.saleDate)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">
                        {sale.saleCurrency} {parseFloat(sale.saleAmount).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent publish activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentPublishTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No publish tasks for Depop yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.recentPublishTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <Badge variant="outline" className="capitalize">
                          {task.status ?? "unknown"}
                        </Badge>
                        {task.errorMessage ? (
                          <p className="mt-1 text-xs text-destructive">
                            {task.errorMessage}
                          </p>
                        ) : null}
                      </div>
                      {task.updatedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {formatShortDate(task.updatedAt)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory sync events</CardTitle>
              <CardDescription>Last 30 days on Depop</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentSyncEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No inventory sync events for Depop yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.recentSyncEvents.map((event) => (
                    <li key={event.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {event.eventType}
                        </Badge>
                        {event.createdAt ? (
                          <span className="text-xs text-muted-foreground">
                            {formatShortDate(event.createdAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-muted-foreground">{event.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span style={{ color: DEPOP_COLOR }}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
