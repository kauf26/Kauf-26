import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../services/api';

interface Listing {
  id: number;
  title: string;
  price: number;
  imageUrl?: string;
  marketplace: string;
  status: string;
  createdAt: string;
}

const MARKETPLACE_COLORS: Record<string, string> = {
  ebay: '#e53238',
  amazon: '#ff9900',
  walmart: '#0071ce',
  wish: '#2fb7ec',
  reverb: '#f04f59',
  etsy: '#f45800',
  shopify: '#95bf47',
  woocommerce: '#96588a',
  aliexpress: '#e62e04',
  mercadolibre: '#ffe600',
  rakuten: '#bf0000',
  bigcommerce: '#34313f',
  prestashop: '#df0067',
};

export default function ListingsScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings`);
      if (response.ok) {
        const data = await response.json();
        setListings(data);
      }
    } catch (error) {
      console.error('Failed to fetch listings');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_BASE_URL}/api/listings/${id}`, {
                method: 'DELETE',
              });
              setListings((prev) => prev.filter((l) => l.id !== id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete listing');
            }
          },
        },
      ]
    );
  };

  const filteredListings = filter
    ? listings.filter((l) => l.marketplace === filter)
    : listings;

  const marketplaceCounts = listings.reduce((acc, listing) => {
    acc[listing.marketplace] = (acc[listing.marketplace] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const renderListing = ({ item }: { item: Listing }) => (
    <View style={styles.listingCard}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.listingImage} />
      ) : (
        <View style={styles.listingImagePlaceholder}>
          <Ionicons name="image-outline" size={24} color="#6b7280" />
        </View>
      )}
      <View style={styles.listingContent}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.listingPrice}>${item.price.toFixed(2)}</Text>
        <View style={styles.listingMeta}>
          <View
            style={[
              styles.marketplaceBadge,
              { backgroundColor: MARKETPLACE_COLORS[item.marketplace] || '#3b82f6' },
            ]}
          >
            <Text style={styles.marketplaceBadgeText}>{item.marketplace}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.status === 'active' ? styles.statusActive : styles.statusPending,
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.filterContainer}>
        <ScrollableFilters
          marketplaceCounts={marketplaceCounts}
          filter={filter}
          setFilter={setFilter}
        />
      </View>

      <FlatList
        data={filteredListings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyText}>No listings yet</Text>
            <Text style={styles.emptySubtext}>
              Upload a product to create your first listing
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ScrollableFilters({
  marketplaceCounts,
  filter,
  setFilter,
}: {
  marketplaceCounts: Record<string, number>;
  filter: string | null;
  setFilter: (f: string | null) => void;
}) {
  const marketplaces = Object.keys(marketplaceCounts);
  const total = Object.values(marketplaceCounts).reduce((a, b) => a + b, 0);

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={[{ id: 'all', count: total }, ...marketplaces.map((m) => ({ id: m, count: marketplaceCounts[m] }))]}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.filtersContent}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.filterChip,
            (filter === null && item.id === 'all') || filter === item.id
              ? styles.filterChipActive
              : null,
          ]}
          onPress={() => setFilter(item.id === 'all' ? null : item.id)}
        >
          <Text
            style={[
              styles.filterChipText,
              (filter === null && item.id === 'all') || filter === item.id
                ? styles.filterChipTextActive
                : null,
            ]}
          >
            {item.id === 'all' ? 'All' : item.id} ({item.count})
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
  },
  filterChipText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  listingImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingContent: {
    flex: 1,
    marginLeft: 12,
  },
  listingTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listingPrice: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  marketplaceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  marketplaceBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#065f46',
  },
  statusPending: {
    backgroundColor: '#92400e',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  deleteButton: {
    padding: 8,
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
  },
});
