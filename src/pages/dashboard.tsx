import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useProductDraftCount } from "@/hooks/use-product-draft-count";
import { useSales } from "@/hooks/use-sales";
import { useListings } from "@/hooks/use-listings";
import {
  useDashboardLayout,
  useSaveDashboardLayout,
} from "@/hooks/use-dashboard-layout";
import GridLayout from "react-grid-layout/legacy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  Package,
  Globe,
  Save,
  RotateCcw
} from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

const defaultLayout: LayoutItem[] = [
  { i: "revenue", x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "sales", x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "fees", x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "netproceeds", x: 0, y: 2, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "products", x: 4, y: 2, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "listings", x: 8, y: 2, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "marketplaces", x: 0, y: 4, w: 6, h: 3, minW: 3, minH: 2 },
  { i: "recent", x: 6, y: 4, w: 6, h: 3, minW: 3, minH: 2 },
];

const widgetInfo: Record<string, { title: string; icon: React.ReactNode; color: string }> = {
  revenue: { title: "Gross Sales", icon: <DollarSign className="w-5 h-5" />, color: "text-blue-500" },
  sales: { title: "Total Sales", icon: <ShoppingBag className="w-5 h-5" />, color: "text-purple-500" },
  fees: { title: "Service Fees (2%)", icon: <TrendingUp className="w-5 h-5" />, color: "text-orange-500" },
  netproceeds: { title: "Net Proceeds", icon: <CheckCircle2 className="w-5 h-5" />, color: "text-green-500" },
  products: { title: "Products", icon: <Package className="w-5 h-5" />, color: "text-cyan-500" },
  listings: { title: "Active Listings", icon: <Globe className="w-5 h-5" />, color: "text-indigo-500" },
  marketplaces: { title: "Marketplace Breakdown", icon: <Globe className="w-5 h-5" />, color: "text-primary" },
  recent: { title: "Recent Activity", icon: <Clock className="w-5 h-5" />, color: "text-primary" },
};

function layoutsEqual(a: LayoutItem[], b: LayoutItem[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Dashboard() {
  const { toast } = useToast();
  const [layout, setLayout] = useState<LayoutItem[]>(defaultLayout);
  const [hasChanges, setHasChanges] = useState(false);
  const layoutHydratedRef = useRef(false);

  const { data: sales = [], isFetching: salesFetching } = useSales();
  const { data: listings = [], isFetching: listingsFetching } = useListings();
  const { data: productCount = 0, isFetching: productCountFetching } =
    useProductDraftCount();
  const { data: savedLayout, isFetching: layoutFetching } = useDashboardLayout();

  const dashboardDataLoading =
    salesFetching || listingsFetching || layoutFetching || productCountFetching;

  const saveLayoutMutation = useSaveDashboardLayout();

  useEffect(() => {
    if (layoutHydratedRef.current || savedLayout === undefined) return;
    layoutHydratedRef.current = true;

    if (savedLayout.layout) {
      try {
        const parsed = JSON.parse(savedLayout.layout) as LayoutItem[];
        setLayout(parsed);
      } catch {
        setLayout(defaultLayout);
      }
    }
  }, [savedLayout?.layout]);

  const handleLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout((prev) => {
      if (layoutsEqual(prev, newLayout)) return prev;
      setHasChanges(true);
      return newLayout;
    });
  }, []);

  const handleSave = () => {
    if (saveLayoutMutation.isPending) return;
    saveLayoutMutation.mutate(layout, {
      onSuccess: () => {
        setHasChanges(false);
        toast({
          title: "Layout saved!",
          description: "Your dashboard arrangement has been saved.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to save layout",
          variant: "destructive",
        });
      },
    });
  };

  const handleReset = () => {
    setLayout(defaultLayout);
    setHasChanges(true);
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.saleAmount), 0);
  const totalFees = sales.reduce((sum, sale) => sum + parseFloat(sale.ourFee), 0);
  const netProceeds = totalRevenue - totalFees;
  const activeListings = listings.filter(l => l.status === "active").length;

  const marketplaceStats = listings.reduce((acc, listing) => {
    acc[listing.marketplace] = (acc[listing.marketplace] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recentSales = sales.slice(0, 5);

  const renderWidget = (id: string) => {
    const info = widgetInfo[id];
    if (!info) return null;

    switch (id) {
      case "revenue":
        return (
          <div className="text-center">
            <div className={`text-4xl font-bold ${info.color}`}>${totalRevenue.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground mt-2">Lifetime earnings</p>
          </div>
        );
      case "sales":
        return (
          <div className="text-center">
            <div className={`text-4xl font-bold ${info.color}`}>{sales.length}</div>
            <p className="text-sm text-muted-foreground mt-2">Completed transactions</p>
          </div>
        );
      case "fees":
        return (
          <div className="text-center">
            <div className={`text-4xl font-bold ${info.color}`}>${totalFees.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground mt-2">Total service fees</p>
          </div>
        );
      case "netproceeds":
        return (
          <div className="text-center">
            <div className={`text-4xl font-bold ${info.color}`}>${netProceeds.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground mt-2">Your earnings</p>
          </div>
        );
      case "products":
        return (
          <div className="text-center">
            <div className={`text-4xl font-bold ${info.color}`}>{productCount}</div>
            <p className="text-sm text-muted-foreground mt-2">Products uploaded</p>
          </div>
        );
      case "listings":
        return (
          <div className="text-center">
            <div className={`text-4xl font-bold ${info.color}`}>{activeListings}</div>
            <p className="text-sm text-muted-foreground mt-2">Live on marketplaces</p>
          </div>
        );
      case "marketplaces":
        return (
          <div className="space-y-2 overflow-y-auto max-h-full">
            {Object.entries(marketplaceStats).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">No listings yet</p>
            ) : (
              Object.entries(marketplaceStats).map(([marketplace, count]) => (
                <div key={marketplace} className="flex justify-between items-center">
                  {marketplace === "depop" ? (
                    <Link href="/analytics/depop" className="capitalize text-sm text-primary hover:underline">
                      {marketplace}
                    </Link>
                  ) : (
                    <span className="capitalize text-sm">{marketplace}</span>
                  )}
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </div>
        );
      case "recent":
        return (
          <div className="space-y-2 overflow-y-auto max-h-full">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">No sales yet</p>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center text-sm">
                  <span>Sale #{sale.id}</span>
                  <span className="font-semibold">${parseFloat(sale.saleAmount).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <LayoutDashboard className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Drag and resize widgets to customize your view
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset-layout"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveLayoutMutation.isPending || dashboardDataLoading}
              data-testid="button-save-layout"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Layout
            </Button>
          </div>
        </div>

        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={60}
          width={1200}
          onLayoutChange={(newLayout) => handleLayoutChange(newLayout as unknown as LayoutItem[])}
          draggableHandle=".drag-handle"
          isResizable={true}
          isDraggable={true}
        >
          {layout.map((item) => {
            const info = widgetInfo[item.i];
            if (!info) return null;
            return (
              <div key={item.i} data-testid={`widget-${item.i}`}>
                <Card className="h-full flex flex-col">
                  <CardHeader className="drag-handle cursor-move pb-2 flex-shrink-0">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <span className={info.color}>{info.icon}</span>
                      {info.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex items-center justify-center overflow-hidden">
                    {renderWidget(item.i)}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </GridLayout>
      </div>
    </div>
  );
}
