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
  buildListingPolicyContext,
  checkMarketplaceRestrictions,
  filterAllowedMarketplaces,
  isUnknownProductCategory,
  setMarketplacePoliciesOverride,
  type MarketplacePoliciesDocument,
} from '../../../shared/marketplaceKeywordBlocker';

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
  const [policiesLoading, setPoliciesLoading] = useState(true);

  const productCategory = listing.category?.trim() ?? '';
  const categoryContext = useMemo(
    () =>
      buildListingPolicyContext({
        title: listing.title,
        description: listing.description,
        price: listing.price,
      }),
    [listing.title, listing.description, listing.price]
  );
  const unknownCategory = isUnknownProductCategory(productCategory);

  useEffect(() => {
    void getTranslateInternationalEnabled().then(setTranslateInternational);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadKeywordPolicies = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/marketplaces/blocked-keywords`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          version?: number;
          policies?: MarketplacePoliciesDocument['marketplaces'];
        };
        if (cancelled || !body.policies) return;
        setMarketplacePoliciesOverride({
          version: body.version ?? 1,
          marketplaces: body.policies,
        });
      } catch {
        // Bundled shared policies remain the fallback.
      } finally {
        if (!cancelled) setPoliciesLoading(false);
      }
    };

    void loadKeywordPolicies();
    return () => {
      cancelled = true;
      setMarketplacePoliciesOverride(null);
    };
  }, []);

  useEffect(() => {
    setSelected((prev) =>
      filterAllowedMarketplaces(prev, productCategory, categoryContext)
    );
  }, [productCategory, categoryContext]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const onToggleTranslateInternational = (value: boolean) => {
    setTranslateInternational(value);
    void setTranslateInternationalEnabled(value);
  };

  const toggleMarketplace = (id: string) => {
    const restriction = checkMarketplaceRestrictions(
      id,
      productCategory,
      categoryContext
    );
    if (!restriction.supported) {
      Alert.alert(
        'Not allowed',
        [restriction.disabledReason, restriction.policyHint].filter(Boolean).join('\n\n')
      );
      return;
    }

    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllSupported = (markets: { id: string; label: string }[]) => {
    const supported = filterAllowedMarketplaces(
      markets.map((m) => m.id),
      productCategory,
      categoryContext
    );
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
          const restriction = checkMarketplaceRestrictions(
            marketplace.id,
            productCategory,
            categoryContext
          );
          const isDisabled = !restriction.supported;

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
                {isDisabled ? (
                  <Text style={styles.restrictionText}>
                    {restriction.disabledReason ?? restriction.policyHint}
                  </Text>
                ) : null}
                {isDisabled && restriction.policyHint && restriction.disabledReason ? (
                  <Text style={styles.policyHintText}>{restriction.policyHint}</Text>
                ) : null}
                {!isDisabled &&
                restriction.warnings &&
                restriction.warnings.length > 0 ? (
                  <Text style={styles.warningText}>⚠ {restriction.warnings[0]}</Text>
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

  const handlePublish = async () => {
    const allowedSelected = filterAllowedMarketplaces(
      selected,
      productCategory,
      categoryContext
    );

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

  const supportedSelectedCount = filterAllowedMarketplaces(
    selected,
    productCategory,
    categoryContext
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

        {policiesLoading ? (
          <View style={styles.policiesLoadingRow}>
            <ActivityIndicator size="small" color="#6B7280" />
            <Text style={styles.policiesLoadingText}>Loading marketplace rules…</Text>
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
