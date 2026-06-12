import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchPublishedListings,
  type PublishedListing,
} from '../services/publishedListings';
import { truncateListingUrl } from '../../../shared/marketplaceListingUrl';

const MARKETPLACE_COLORS: Record<string, string> = {
  aliexpress: '#e62e04',
  allegro: '#ff5a00',
  amazon: '#ff9900',
  bigcommerce: '#34313f',
  bolcom: '#0000ff',
  depop: '#ff2300',
  ebay: '#e53238',
  etsy: '#f45800',
  flipkart: '#2874f0',
  fruugo: '#00a651',
  lazada: '#0f146d',
  magento: '#f26322',
  mercadolibre: '#ffe600',
  mercadolibre_br: '#ffe600',
  newegg: '#f7941d',
  poshmark: '#7b2d8e',
  rakuten: '#bf0000',
  shopee: '#ee4d2d',
  shopify: '#95bf47',
  stockx: '#006340',
  taobao: '#ff5000',
  tiktokshop: '#000000',
  vinted: '#09b1ba',
  wayfair: '#7b2d8e',
  woocommerce: '#96588a',
  zalando: '#ff6900',
};

export default function ListingsScreen() {
  const [listings, setListings] = useState<PublishedListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    try {
      const data = await fetchPublishedListings();
      setListings(data);
    } catch (error) {
      console.error('Failed to fetch published listings', error);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadListings();
    setRefreshing(false);
  };

  const openListingUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Cannot open link', url);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open link', 'Please try again in your browser.');
    }
  };

  const filteredListings = filter
    ? listings.filter((l) => l.marketplace === filter)
    : listings;

  const marketplaceCounts = listings.reduce((acc, listing) => {
    acc[listing.marketplace] = (acc[listing.marketplace] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const renderListing = ({ item }: { item: PublishedListing }) => (
    <View style={styles.listingCard}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.listingImage} />
      ) : (
        <View style={styles.listingImagePlaceholder}>
          <Ionicons name="image-outline" size={24} color="#6b7280" />
        </View>
      )}
      <View style={styles.listingContent}>
        <Text style={styles.listingTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.listingPrice}>
          {item.currency} {item.price}
        </Text>
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
        {item.listingUrl ? (
          <TouchableOpacity
            style={styles.viewListingButton}
            activeOpacity={0.65}
            onPress={() => void openListingUrl(item.listingUrl!)}
          >
            <Ionicons name="open-outline" size={14} color="#93c5fd" />
            <Text style={styles.viewListingText}>View live listing</Text>
          </TouchableOpacity>
        ) : null}
        {item.listingUrl ? (
          <TouchableOpacity
            activeOpacity={0.65}
            onPress={() => void openListingUrl(item.listingUrl!)}
          >
            <Text style={styles.listingUrlText} numberOfLines={1}>
              {truncateListingUrl(item.listingUrl, 42)}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.listingUrlMissing}>
            Live URL unavailable
            {item.marketplaceListingId ? ` · ID ${item.marketplaceListingId}` : ''}
          </Text>
        )}
      </View>
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
            <Text style={styles.emptyText}>No published listings yet</Text>
            <Text style={styles.emptySubtext}>
              Publish a product to marketplaces to see live links here
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
    alignItems: 'flex-start',
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
    marginBottom: 8,
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
  viewListingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  viewListingText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  listingUrlText: {
    color: '#6b7280',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  listingUrlMissing: {
    color: '#6b7280',
    fontSize: 12,
    fontStyle: 'italic',
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
    paddingHorizontal: 24,
  },
});
