import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../services/api';

interface Sale {
  id: number;
  productTitle: string;
  salePrice: number;
  serviceFee: number;
  netProceeds: number;
  marketplace: string;
  soldAt: string;
}

interface SalesStats {
  totalRevenue: number;
  totalFees: number;
  netProceeds: number;
  salesCount: number;
}

export default function SalesScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<SalesStats>({
    totalRevenue: 0,
    totalFees: 0,
    netProceeds: 0,
    salesCount: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales`);
      if (response.ok) {
        const data = await response.json();
        setSales(data.sales || []);
        setStats({
          totalRevenue: data.totalRevenue || 0,
          totalFees: data.totalFees || 0,
          netProceeds: data.netProceeds || 0,
          salesCount: data.salesCount || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch sales');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSales();
    setRefreshing(false);
  };

  const renderSale = ({ item }: { item: Sale }) => (
    <View style={styles.saleCard}>
      <View style={styles.saleHeader}>
        <Text style={styles.saleTitle} numberOfLines={1}>
          {item.productTitle}
        </Text>
        <View style={styles.marketplaceBadge}>
          <Text style={styles.marketplaceText}>{item.marketplace}</Text>
        </View>
      </View>
      <View style={styles.saleDetails}>
        <View style={styles.saleRow}>
          <Text style={styles.saleLabel}>Sale Price</Text>
          <Text style={styles.saleValue}>${item.salePrice.toFixed(2)}</Text>
        </View>
        <View style={styles.saleRow}>
          <Text style={styles.saleLabel}>Service Fee (2%)</Text>
          <Text style={styles.saleFee}>-${item.serviceFee.toFixed(2)}</Text>
        </View>
        <View style={[styles.saleRow, styles.saleTotalRow]}>
          <Text style={styles.saleTotalLabel}>Net Proceeds</Text>
          <Text style={styles.saleTotalValue}>${item.netProceeds.toFixed(2)}</Text>
        </View>
      </View>
      <Text style={styles.saleDate}>
        {new Date(item.soldAt).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#10b981" />
          <Text style={styles.statValue}>${stats.totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="receipt" size={24} color="#ef4444" />
          <Text style={styles.statValue}>${stats.totalFees.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Service Fees</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="wallet" size={24} color="#3b82f6" />
          <Text style={styles.statValue}>${stats.netProceeds.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Net Proceeds</Text>
        </View>
      </View>

      <View style={styles.feeInfo}>
        <Ionicons name="information-circle" size={16} color="#9ca3af" />
        <Text style={styles.feeInfoText}>
          2% service fee is automatically deducted from each sale
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Recent Sales ({stats.salesCount})</Text>

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
            <Text style={styles.emptySubtext}>
              Your sales will appear here when products are sold
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  feeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  feeInfoText: {
    color: '#9ca3af',
    fontSize: 13,
    flex: 1,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
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
  saleTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  marketplaceBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  marketplaceText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  saleDetails: {
    backgroundColor: '#0a0a0f',
    borderRadius: 8,
    padding: 12,
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  saleLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  saleValue: {
    color: '#ffffff',
    fontSize: 14,
  },
  saleFee: {
    color: '#ef4444',
    fontSize: 14,
  },
  saleTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 8,
    marginBottom: 0,
  },
  saleTotalLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  saleTotalValue: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  saleDate: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
