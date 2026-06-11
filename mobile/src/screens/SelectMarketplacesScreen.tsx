import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { HomeStackParamList, PublishReport } from '../types/navigation';
import { API_BASE_URL } from '../services/config';
import { DEFAULT_IDENTIFY_MARKETPLACES } from '../services/identifyApi';
import {
  getTranslateInternationalEnabled,
  setTranslateInternationalEnabled,
} from '../services/translationPrefs';
import {
  isUsChannelMarketplace,
  MARKETPLACE_CHANNEL_REGION,
} from '../../../shared/marketplaceChannels';

type Props = StackScreenProps<HomeStackParamList, 'SelectMarketplaces'>;

function formatMarketplaceLabel(id: string): string {
  return id
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const ALL_MARKETPLACE_IDS = Object.keys(MARKETPLACE_CHANNEL_REGION);
const US_MARKETS = ALL_MARKETPLACE_IDS.filter((id) => isUsChannelMarketplace(id)).map((id) => ({
  id,
  label: formatMarketplaceLabel(id),
}));
const GLOBAL_MARKETS = ALL_MARKETPLACE_IDS.filter(
  (id) => !isUsChannelMarketplace(id)
).map((id) => ({
  id,
  label: formatMarketplaceLabel(id),
}));

export default function SelectMarketplacesScreen({ route, navigation }: Props) {
  const { draftId, listing } = route.params;
  const [selected, setSelected] = useState<string[]>([...DEFAULT_IDENTIFY_MARKETPLACES]);
  const [translateInternational, setTranslateInternational] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    void getTranslateInternationalEnabled().then(setTranslateInternational);
  }, []);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const onToggleTranslateInternational = (value: boolean) => {
    setTranslateInternational(value);
    void setTranslateInternationalEnabled(value);
  };

  const toggleMarketplace = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const renderMarketList = (markets: { id: string; label: string }[]) =>
    markets.map((marketplace) => {
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
    });

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
          marketplaceIds: selected,
          translateInternational,
          sync: true,
          listing,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as PublishReport & {
        message?: string;
        error?: string;
        success?: boolean;
      };
      if (!res.ok) {
        throw new Error(body.error || body.message || `Publish failed (${res.status})`);
      }
      navigation.navigate('PublishConfirmation', {
        report: {
          ...body,
          title: listing.title || undefined,
          draftId,
        },
      });
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

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>🇺🇸 US-Based Marketplaces</Text>
          <View style={styles.card}>{renderMarketList(US_MARKETS)}</View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>🌐 International Channels</Text>
          <View style={styles.translateRow}>
            <Text style={styles.translateLabel}>Auto-translate for international channels</Text>
            <View style={styles.switchWrap}>
              <Switch
                value={translateInternational}
                onValueChange={onToggleTranslateInternational}
                trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                thumbColor={translateInternational ? '#22C55E' : '#EF4444'}
                ios_backgroundColor="#FCA5A5"
                disabled={publishing}
              />
            </View>
          </View>
          <View style={styles.card}>{renderMarketList(GLOBAL_MARKETS)}</View>
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
  section: { gap: 8 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  translateRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  translateLabel: {
    flex: 1,
    flexShrink: 1,
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 12,
  },
  switchWrap: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }],
  },
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
