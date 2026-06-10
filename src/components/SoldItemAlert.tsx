import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSalesPoll } from "@/hooks/use-sales-poll";
import {
  isShippingLabelPending,
  markShippingLabelCreated,
  type DashboardSale,
} from "@/lib/salesFetch";

const DISMISSED_KEY = "kauf26_dismissedShippingAlerts";

function loadDismissed(): Set<number> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    return new Set(parsed.filter((n) => Number.isInteger(n)));
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<number>): void {
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

export default function SoldItemAlert() {
  const [, setLocation] = useLocation();
  const { data: sales = [] } = useSalesPoll();
  const dismissedRef = useRef(loadDismissed());
  const seenIdsRef = useRef<Set<number>>(new Set());
  const [pendingSale, setPendingSale] = useState<DashboardSale | null>(null);

  useEffect(() => {
    if (sales.length === 0) return;

    for (const sale of sales) {
      if (!Number.isInteger(sale.id)) continue;

      const isNew = !seenIdsRef.current.has(sale.id);
      seenIdsRef.current.add(sale.id);

      if (
        isNew &&
        isShippingLabelPending(sale) &&
        !dismissedRef.current.has(sale.id)
      ) {
        setPendingSale((current) => current ?? sale);
        break;
      }
    }
  }, [sales]);

  const dismiss = (saleId: number, markCreated: boolean) => {
    dismissedRef.current.add(saleId);
    saveDismissed(dismissedRef.current);
    setPendingSale(null);
    if (markCreated) {
      void markShippingLabelCreated(saleId).catch(console.error);
    }
  };

  const handlePrint = () => {
    if (!pendingSale) return;
    const saleId = pendingSale.id;
    setPendingSale(null);
    setLocation(`/dashboard/shipping?saleId=${saleId}`);
  };

  const handleLater = () => {
    if (!pendingSale) return;
    dismiss(pendingSale.id, false);
  };

  const productName =
    pendingSale?.productTitle?.trim() || `Sale #${pendingSale?.id ?? ""}`;

  return (
    <AlertDialog open={pendingSale != null} onOpenChange={(open) => !open && handleLater()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You sold {productName}!</AlertDialogTitle>
          <AlertDialogDescription>
            Ready to print a shipping label for this order?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLater}>Later</AlertDialogCancel>
          <AlertDialogAction onClick={handlePrint}>Print Label</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
