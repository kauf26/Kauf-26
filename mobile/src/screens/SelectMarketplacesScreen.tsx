import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { HomeStackParamList } from '../types/identify';
import { API_BASE_URL } from '../services/config';
import { DEFAULT_IDENTIFY_MARKETPLACES } from '../services/identifyApi';

type Props = StackScreenProps<HomeStackParamList, 'SelectMarketplaces'>;

const MARKETPLACE_OPTIONS = [
  { id: 'ebay', label: 'eBay' },
  { id: 'etsy', label: 'Etsy' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'depop', label: 'Depop' },
  { id: 'poshmark', label: 'Poshmark' },
] as const;

export default function SelectMarketplacesScreen({ route, navigation }: Props) {
  const { draftId, listing } = route.params;
  const [selected, setSelected] = useState<string[]>([...DEFAULT_IDENTIFY_MARKETPLACES]);
  const [publishing, setPublishing] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleMarketplace = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePublish = async () => {
    if (selected.length === 0) {
      Alert.alert('Select marketplaces', 'Choose at least one marketplace to publish.');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplaces/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          draftId,
          marketplaces: selected,
          listing,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        jobId?: number;
      };
      if (!res.ok) {
        throw new Error(body.error || body.message || `Publish failed (${res.status})`);
      }
      Alert.alert(
        'Publishing queued',
        body.message || 'Your listing is being published to the selected marketplaces.',
        [{ text: 'OK', onPress: () => navigation.navigate('Identify') }]
      );
    } catch (err) {
      Alert.alert(
        'Publish failed',
        err instanceof Error ? err.message : 'Could not publish listing.'
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Select Marketplaces</Text>
        <Text style={styles.subtitle}>
          Choose where to publish &quot;{listing.title || 'your product'}&quot;.
        </Text>

        <View style={styles.card}>
          {MARKETPLACE_OPTIONS.map((marketplace) => {
            const active = selectedSet.has(marketplace.id);
            return (
              <TouchableOpacity
                key={marketplace.id}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => toggleMarketplace(marketplace.id)}
              >
                <Text style={styles.rowLabel}>{marketplace.label}</Text>
                <Text style={styles.rowState}>{active ? 'Selected' : 'Tap to select'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.publishButton, publishing && styles.buttonDisabled]}
          onPress={() => void handlePublish()}
          disabled={publishing}
        >
          {publishing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.publishButtonText}>Publish to selected marketplaces</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowActive: { backgroundColor: '#EFF6FF' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowState: { fontSize: 12, color: '#6B7280' },
  publishButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  publishButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
});
