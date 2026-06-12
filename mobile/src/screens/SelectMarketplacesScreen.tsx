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
import {
  UNKNOWN_CATEGORY_WARNING,
  isUnknownProductCategory,
} from '../../../shared/marketplaceKeywordBlocker';
import PublishPinModal from '../components/PublishPinModal';

type EligibilityResult = {
  marketplaceId: string;
  allowed: boolean;
  reason: string | null;
};
import { isRequiresAuthForPublish } from '../auth/publishAuth';

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
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [eligibility, setEligibility] = useState<Record<string, EligibilityResult>>({});
  const [publishAuthVisible, setPublishAuthVisible] = useState(false);
  const [publishAuthRequired, setPublishAuthRequired] = useState(true);

  const productCategory = listing.category?.trim() ?? '';
  const unknownCategory = isUnknownProductCategory(productCategory);

  useEffect(() => {
    void getTranslateInternationalEnabled().then(setTranslateInternational);
    void isRequiresAuthForPublish().then(setPublishAuthRequired);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadEligibility = async () => {
      setEligibilityLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/marketplaces/check-eligibility`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: listing.title,
            description: listing.description,
            price: listing.price,
            category: productCategory,
            condition: listing.condition,
            brand: listing.brand,
            marketplaceIds: ALL_MARKETPLACE_IDS,
          }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { results?: EligibilityResult[] };
        if (cancelled || !body.results) return;
        const next: Record<string, EligibilityResult> = {};
        for (const row of body.results) {
          next[row.marketplaceId] = row;
        }
        setEligibility(next);
      } catch {
        // All marketplaces remain selectable if the server is unreachable.
      } finally {
        if (!cancelled) setEligibilityLoading(false);
      }
    };

    void loadEligibility();
    return () => {
      cancelled = true;
    };
  }, [
    listing.title,
    listing.description,
    listing.price,
    productCategory,
    listing.condition,
    listing.brand,
  ]);

  useEffect(() => {
    setSelected((prev) =>
      prev.filter((id) => eligibility[id]?.allowed !== false)
    );
  }, [eligibility]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const onToggleTranslateInternational = (value: boolean) => {
    setTranslateInternational(value);
    void setTranslateInternationalEnabled(value);
  };

  const getEligibilityReason = (id: string): string | null => {
    const row = eligibility[id];
    if (!row || row.allowed) return null;
    return row.reason;
  };

  const toggleMarketplace = (id: string) => {
    const blockReason = getEligibilityReason(id);
    if (blockReason) {
      Alert.alert('Not allowed', blockReason);
      return;
    }

    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllSupported = (markets: { id: string; label: string }[]) => {
    const supported = markets
      .map((m) => m.id)
      .filter((id) => eligibility[id]?.allowed !== false);
    setSelected((prev) => [...new Set([...prev, ...supported])]);
  };

  const renderMarketList = (
    markets: { id: string; label: string }[],
    sectionLabel: string
  ) => (
    <>
      <View style={styles.sectionToolbar}>
        <Text style={styles.sectionHeader}>{sectionLabel}</Text>
        <TouchableOpacity onPress={() => selectAllSupported(markets)} disabled={publishing}>
          <Text style={styles.selectSupportedLink}>Select all supported</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        {markets.map((marketplace) => {
          const active = selectedSet.has(marketplace.id);
          const blockReason = getEligibilityReason(marketplace.id);
          const isDisabled = blockReason != null;

          return (
            <TouchableOpacity
              key={marketplace.id}
              style={[
                styles.row,
                active && !isDisabled && styles.rowActive,
                isDisabled && styles.rowDisabled,
              ]}
              onPress={() => toggleMarketplace(marketplace.id)}
              disabled={isDisabled || publishing}
            >
              <View style={styles.rowBody}>
                <Text
                  style={[
                    styles.rowLabel,
                    isDisabled && styles.rowLabelDisabled,
                    active && !isDisabled && styles.rowLabelActive,
                  ]}
                >
                  {isDisabled ? '🔒 ' : ''}
                  {marketplace.label}
                </Text>
                {isDisabled && blockReason ? (
                  <Text style={styles.restrictionText}>{blockReason}</Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.rowState,
                  isDisabled && styles.rowStateDisabled,
                  active && !isDisabled && styles.rowStateActive,
                ]}
              >
                {isDisabled ? 'Blocked' : active ? 'Selected' : 'Tap to select'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const runPublish = async () => {
    const allowedSelected = selected.filter((id) => eligibility[id]?.allowed !== false);

    if (allowedSelected.length === 0) {
      Alert.alert(
        'No allowed marketplaces',
        'This product category or keywords are not supported on the selected marketplaces. Choose supported channels only.'
      );
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
          marketplaceIds: allowedSelected,
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

  const handlePublish = () => {
    if (publishAuthRequired) {
      setPublishAuthVisible(true);
      return;
    }
    void runPublish();
  };

  const supportedSelectedCount = selected.filter(
    (id) => eligibility[id]?.allowed !== false
  ).length;

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Select Marketplaces</Text>
        <Text style={styles.subtitle}>
          Choose where to publish &quot;{listing.title || 'your product'}&quot;.
        </Text>

        {unknownCategory ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{UNKNOWN_CATEGORY_WARNING}</Text>
          </View>
        ) : null}

        {eligibilityLoading ? (
          <View style={styles.policiesLoadingRow}>
            <ActivityIndicator size="small" color="#6B7280" />
            <Text style={styles.policiesLoadingText}>Checking marketplace eligibility…</Text>
          </View>
        ) : null}

        <View style={styles.section}>{renderMarketList(US_MARKETS, '🇺🇸 US-Based Marketplaces')}</View>

        <View style={styles.section}>
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
          {renderMarketList(GLOBAL_MARKETS, '🌐 International Channels')}
        </View>

        <TouchableOpacity
          style={[
            styles.publishButton,
            (publishing || supportedSelectedCount === 0) && styles.buttonDisabled,
          ]}
          onPress={() => void handlePublish()}
          disabled={publishing || supportedSelectedCount === 0}
        >
          {publishing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.publishButtonText}>
              Publish to {supportedSelectedCount} marketplace
              {supportedSelectedCount === 1 ? '' : 's'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <PublishPinModal
        visible={publishAuthVisible}
        title="Authenticate to publish"
        subtitle="Confirm with Face ID / Touch ID or your 4-digit PIN"
        onSuccess={() => {
          setPublishAuthVisible(false);
          void runPublish();
        }}
        onCancel={() => setPublishAuthVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  section: { gap: 8 },
  sectionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
  },
  selectSupportedLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  noticeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noticeText: { fontSize: 13, color: '#92400E', lineHeight: 18 },
  policiesLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  policiesLoadingText: { fontSize: 12, color: '#6B7280' },
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
    gap: 12,
  },
  rowActive: { backgroundColor: '#EFF6FF' },
  rowDisabled: { backgroundColor: '#FEF2F2', opacity: 0.95 },
  rowBody: { flex: 1, gap: 4 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowLabelActive: { color: '#1D4ED8' },
  rowLabelDisabled: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  restrictionText: { fontSize: 12, color: '#DC2626', lineHeight: 16 },
  policyHintText: { fontSize: 11, color: '#6B7280', lineHeight: 15 },
  warningText: { fontSize: 12, color: '#B45309', lineHeight: 16 },
  rowState: { fontSize: 12, color: '#6B7280' },
  rowStateActive: { color: '#2563EB', fontWeight: '700' },
  rowStateDisabled: { color: '#DC2626', fontWeight: '700' },
  publishButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  publishButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
});
