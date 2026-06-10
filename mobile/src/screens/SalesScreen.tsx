import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchSalesLive, type MobileSale } from '../services/shipping';
import ShippingLabelScreen from './ShippingLabelScreen';

export default function SalesScreen() {
  const [sales, setSales] = useState<MobileSale[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [shippingSale, setShippingSale] = useState<MobileSale | null>(null);

  useEffect(() => {
    void loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setSales(await fetchSalesLive());
    } catch {
      console.error('Failed to fetch sales');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.saleAmount || '0'), 0);
  const totalFees = sales.reduce((sum, s) => sum + parseFloat(s.ourFee || '0'), 0);
  const netProceeds = totalRevenue - totalFees;

  const renderSale = ({ item }: { item: MobileSale }) => {
    const saleAmount = parseFloat(item.saleAmount || '0');
    const ourFee = parseFloat(item.ourFee || '0');
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
            <Text style={styles.saleTotalValue}>${(saleAmount - ourFee).toFixed(2)}</Text>
          </View>
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
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#10b981" />
          <Text style={styles.statValue}>${totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="receipt" size={24} color="#ef4444" />
          <Text style={styles.statValue}>${totalFees.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Service Fees</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="wallet" size={24} color="#3b82f6" />
          <Text style={styles.statValue}>${netProceeds.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Net Proceeds</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Sales ({sales.length})</Text>

      <FlatList
        data={sales}
        renderItem={renderSale}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyText}>No sales yet</Text>
          </View>
        }
      />

      <Modal visible={shippingSale != null} animationType="slide">
        {shippingSale ? (
          <ShippingLabelScreen
            sale={shippingSale}
            onClose={() => setShippingSale(null)}
            onComplete={() => setShippingSale(null)}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
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
    marginTop: 12,
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
    marginBottom: 12,
  },
  saleTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  marketplaceBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  marketplaceText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
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
  labelButton: {
    marginTop: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  labelButtonText: { color: '#ffffff', fontWeight: '600' },
  saleDate: { color: '#6b7280', fontSize: 12, marginTop: 12, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginTop: 16 },
});
