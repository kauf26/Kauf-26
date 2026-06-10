import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchSalesLive,
  updateSaleStatus,
  type MobileSale,
} from '../services/shipping';
import {
  filterSalesList,
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  resolveFulfillmentStatus,
  resolvePaymentStatus,
  SALE_STATUS_FILTER_LABELS,
  type SaleStatusFilter,
  type SaleTimelineFilter,
} from '../../../shared/saleStatus';
import ShippingLabelScreen from './ShippingLabelScreen';

const STATUS_FILTERS = Object.keys(SALE_STATUS_FILTER_LABELS) as SaleStatusFilter[];

export default function SalesScreen() {
  const [sales, setSales] = useState<MobileSale[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [shippingSale, setShippingSale] = useState<MobileSale | null>(null);
  const [timeline, setTimeline] = useState<SaleTimelineFilter>('last45');
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadSales = async () => {
    try {
      setSales(await fetchSalesLive());
    } catch {
      console.error('Failed to fetch sales');
    }
  };

  React.useEffect(() => {
    void loadSales();
  }, []);

  const filteredSales = useMemo(
    () => filterSalesList(sales, timeline, statusFilter),
    [sales, timeline, statusFilter]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  };

  const handleStatusUpdate = async (
    saleId: number,
    patch: Parameters<typeof updateSaleStatus>[1]
  ) => {
    setUpdatingId(saleId);
    try {
      const updated = await updateSaleStatus(saleId, patch);
      setSales((prev) => prev.map((s) => (s.id === saleId ? updated : s)));
    } catch (error) {
      Alert.alert(
        'Update failed',
        error instanceof Error ? error.message : 'Try again'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const totalRevenue = filteredSales.reduce(
    (sum, s) => sum + parseFloat(s.saleAmount || '0'),
    0
  );
  const totalFees = filteredSales.reduce(
    (sum, s) => sum + parseFloat(s.ourFee || '0'),
    0
  );
  const netProceeds = totalRevenue - totalFees;

  const renderSale = ({ item }: { item: MobileSale }) => {
    const payment = resolvePaymentStatus(item);
    const fulfillment = resolveFulfillmentStatus(item);
    const saleAmount = parseFloat(item.saleAmount || '0');
    const ourFee = parseFloat(item.ourFee || '0');
    const busy = updatingId === item.id;

    return (
      <View style={styles.saleCard}>
        <View style={styles.saleHeader}>
          <Text style={styles.saleTitle} numberOfLines={1}>
            {item.productTitle ?? `Sale #${item.id}`}
          </Text>
          <View style={styles.marketplaceBadge}>
            <Text style={styles.marketplaceText}>{item.marketplace ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles.paymentBadge]}>
            <Text style={styles.badgeText}>{PAYMENT_STATUS_LABELS[payment]}</Text>
          </View>
          <View style={[styles.badge, styles.fulfillmentBadge]}>
            <Text style={styles.badgeText}>
              {FULFILLMENT_STATUS_LABELS[fulfillment]}
            </Text>
          </View>
        </View>

        <View style={styles.saleDetails}>
          <View style={styles.saleRow}>
            <Text style={styles.saleLabel}>Sale Price</Text>
            <Text style={styles.saleValue}>${saleAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.saleRow}>
            <Text style={styles.saleLabel}>Service Fee (2%)</Text>
            <Text style={styles.saleFee}>-${ourFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.saleRow, styles.saleTotalRow]}>
            <Text style={styles.saleTotalLabel}>Net Proceeds</Text>
            <Text style={styles.saleTotalValue}>
              ${(saleAmount - ourFee).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          {payment !== 'completed' && (
            <TouchableOpacity
              style={styles.actionButton}
              disabled={busy}
              onPress={() =>
                void handleStatusUpdate(item.id, { payment_status: 'completed' })
              }
            >
              <Text style={styles.actionButtonText}>Payment Received</Text>
            </TouchableOpacity>
          )}
          {fulfillment === 'not_shipped' && (
            <TouchableOpacity
              style={styles.actionButton}
              disabled={busy}
              onPress={() =>
                void handleStatusUpdate(item.id, { fulfillment_status: 'shipped' })
              }
            >
              <Text style={styles.actionButtonText}>Mark Shipped</Text>
            </TouchableOpacity>
          )}
          {fulfillment === 'shipped' && (
            <TouchableOpacity
              style={styles.actionButton}
              disabled={busy}
              onPress={() =>
                void handleStatusUpdate(item.id, { fulfillment_status: 'delivered' })
              }
            >
              <Text style={styles.actionButtonText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}
          {fulfillment !== 'accepted' && (
            <TouchableOpacity
              style={styles.actionButton}
              disabled={busy}
              onPress={() =>
                void handleStatusUpdate(item.id, { fulfillment_status: 'accepted' })
              }
            >
              <Text style={styles.actionButtonText}>Mark Accepted</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.labelButton} onPress={() => setShippingSale(item)}>
          <Text style={styles.labelButtonText}>Create Shipping Label</Text>
        </TouchableOpacity>
        <Text style={styles.saleDate}>
          {item.saleDate ? new Date(item.saleDate).toLocaleDateString() : '—'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.timelineRow}>
          <TouchableOpacity
            style={[styles.timelineChip, timeline === 'last45' && styles.timelineChipActive]}
            onPress={() => setTimeline('last45')}
          >
            <Text
              style={[
                styles.timelineChipText,
                timeline === 'last45' && styles.timelineChipTextActive,
              ]}
            >
              Last 45 days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timelineChip, timeline === 'yearly' && styles.timelineChipActive]}
            onPress={() => setTimeline('yearly')}
          >
            <Text
              style={[
                styles.timelineChipText,
                timeline === 'yearly' && styles.timelineChipTextActive,
              ]}
            >
              Yearly ({new Date().getFullYear()})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.statusFilterRow}>
          {STATUS_FILTERS.map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.statusChip,
                statusFilter === key && styles.statusChipActive,
              ]}
              onPress={() => setStatusFilter(key)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  statusFilter === key && styles.statusChipTextActive,
                ]}
              >
                {SALE_STATUS_FILTER_LABELS[key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#10b981" />
          <Text style={styles.statValue}>${totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="receipt" size={24} color="#ef4444" />
          <Text style={styles.statValue}>${totalFees.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Fees</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="wallet" size={24} color="#3b82f6" />
          <Text style={styles.statValue}>${netProceeds.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Net</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Sales ({filteredSales.length})
      </Text>

      <FlatList
        data={filteredSales}
        renderItem={renderSale}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyText}>No sales in this view</Text>
          </View>
        }
      />

      <Modal visible={shippingSale != null} animationType="slide">
        {shippingSale ? (
          <ShippingLabelScreen
            sale={shippingSale}
            onClose={() => setShippingSale(null)}
            onComplete={() => {
              setShippingSale(null);
              void loadSales();
            }}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  filterScroll: { maxHeight: 44, marginTop: 8 },
  timelineRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  timelineChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  timelineChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  timelineChipText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  timelineChipTextActive: { color: '#ffffff' },
  statusFilterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  statusChipActive: { borderColor: '#3b82f6', backgroundColor: '#1e3a5f' },
  statusChipText: { color: '#9ca3af', fontSize: 12 },
  statusChipTextActive: { color: '#ffffff' },
  statsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  statLabel: { color: '#9ca3af', fontSize: 11, marginTop: 4, textAlign: 'center' },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  saleCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  marketplaceBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  marketplaceText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  paymentBadge: { backgroundColor: '#374151' },
  fulfillmentBadge: { backgroundColor: '#1e3a5f' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  saleDetails: { backgroundColor: '#0a0a0f', borderRadius: 8, padding: 12 },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  saleLabel: { color: '#9ca3af', fontSize: 14 },
  saleValue: { color: '#ffffff', fontSize: 14 },
  saleFee: { color: '#ef4444', fontSize: 14 },
  saleTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 8,
    marginBottom: 0,
  },
  saleTotalLabel: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  saleTotalValue: { color: '#10b981', fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  labelButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  labelButtonText: { color: '#ffffff', fontWeight: '600' },
  saleDate: { color: '#6b7280', fontSize: 12, marginTop: 12, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginTop: 16 },
});
