import { useEffect, useRef, useState } from 'react';
import { Alert, Modal } from 'react-native';
import {
  fetchSalesLive,
  isShippingLabelPending,
  type MobileSale,
} from '../services/shipping';
import ShippingLabelScreen from '../screens/ShippingLabelScreen';

const POLL_MS = 30_000;

export default function SoldItemAlertMobile() {
  const seenRef = useRef<Set<number>>(new Set());
  const dismissedRef = useRef<Set<number>>(new Set());
  const [shippingSale, setShippingSale] = useState<MobileSale | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkSales = async () => {
      try {
        const sales = await fetchSalesLive();
        if (cancelled) return;

        for (const sale of sales) {
          if (!Number.isInteger(sale.id)) continue;
          const isNew = !seenRef.current.has(sale.id);
          seenRef.current.add(sale.id);

          if (
            isNew &&
            isShippingLabelPending(sale) &&
            !dismissedRef.current.has(sale.id)
          ) {
            const name = sale.productTitle ?? `Sale #${sale.id}`;
            Alert.alert(
              'Item sold!',
              `You sold ${name}! Ready to print shipping label?`,
              [
                {
                  text: 'Later',
                  style: 'cancel',
                  onPress: () => dismissedRef.current.add(sale.id),
                },
                {
                  text: 'Print Label',
                  onPress: () => setShippingSale(sale),
                },
              ]
            );
            break;
          }
        }
      } catch {
        /* ignore poll errors */
      }
    };

    void checkSales();
    const timer = setInterval(() => void checkSales(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Modal visible={shippingSale != null} animationType="slide">
      {shippingSale ? (
        <ShippingLabelScreen
          sale={shippingSale}
          onClose={() => setShippingSale(null)}
          onComplete={() => {
            dismissedRef.current.add(shippingSale.id);
            setShippingSale(null);
          }}
        />
      ) : null}
    </Modal>
  );
}
