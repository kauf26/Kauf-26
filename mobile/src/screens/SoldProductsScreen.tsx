import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchSoldProducts,
  type SoldProductSummary,
} from '../services/soldProducts';

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

export default function SoldProductsScreen() {
  const [products, setProducts] = useState<SoldProductSummary[]>([]);
  const [totalSoldProducts, setTotalSoldProducts] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    const data = await fetchSoldProducts(pageNum, PAGE_SIZE);
    setTotalSoldProducts(data.totalSoldProducts);
    setHasMore(data.hasMore);
    setPage(data.page);
    setProducts((prev) => (append ? [...prev, ...data.products] : data.products));
  }, []);

  useEffect(() => {
    void loadPage(1, false)
      .catch(() => {
        setProducts([]);
        setTotalSoldProducts(0);
      })
      .finally(() => setInitialLoading(false));
  }, [loadPage]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPage(1, false);
    } catch {
      setProducts([]);
      setTotalSoldProducts(0);
    } finally {
      setRefreshing(false);
    }
  };

  const onEndReached = async () => {
    if (!hasMore || loadingMore || refreshing) return;
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch {
      /* keep existing list */
    } finally {
      setLoadingMore(false);
    }
  };

  const renderItem = ({ item }: { item: SoldProductSummary }) => (
    <View style={styles.card}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Ionicons name="cube-outline" size={28} color="#6b7280" />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.meta}>
          {item.total_quantity_sold} sold · Last {formatDate(item.most_recent_sale_date)}
        </Text>
        <Text style={styles.revenue}>
          ${parseFloat(item.total_revenue).toFixed(2)} total
        </Text>
      </View>
    </View>
  );

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#3b82f6" />
        }
        onEndReached={() => void onEndReached()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sold Products</Text>
            <Text style={styles.headerSubtitle}>
              Products with completed payment or fulfillment
            </Text>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total sold products</Text>
              <Text style={styles.totalValue}>{totalSoldProducts}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyTitle}>No sold products yet</Text>
            <Text style={styles.emptyText}>
              Products appear here once a sale is paid or shipped.
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footerLoader} color="#3b82f6" />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 16 },
  totalCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
  },
  totalLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 4 },
  totalValue: { fontSize: 36, fontWeight: '700', color: '#3b82f6' },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    marginBottom: 10,
  },
  thumbnail: { width: 72, height: 72, borderRadius: 8 },
  thumbnailPlaceholder: {
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  meta: { fontSize: 13, color: '#9ca3af', marginBottom: 4 },
  revenue: { fontSize: 15, fontWeight: '700', color: '#22c55e' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  footerLoader: { marginVertical: 16 },
});
