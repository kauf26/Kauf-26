import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { HomeStackParamList, PublishOutcome } from '../types/navigation';

type Props = StackScreenProps<HomeStackParamList, 'PublishConfirmation'>;

function outcomeLabel(outcome: PublishOutcome): { text: string; color: string; bg: string } {
  if (!outcome.success) {
    return { text: 'Failed', color: '#B91C1C', bg: '#FEE2E2' };
  }
  if (outcome.dryRun) {
    return { text: 'Dry Run', color: '#B45309', bg: '#FEF3C7' };
  }
  return { text: 'Published', color: '#047857', bg: '#D1FAE5' };
}

export default function PublishConfirmationScreen({ route, navigation }: Props) {
  const { report } = route.params;
  const outcomes = report.outcomes ?? [];
  const published = outcomes.filter((o) => o.success && !o.dryRun).length;
  const dryRun = outcomes.filter((o) => o.success && o.dryRun).length;
  const failed = outcomes.filter((o) => !o.success).length;

  if (outcomes.length === 0) {
    return (
      <SafeAreaView style={styles.page} edges={['bottom']}>
        <View style={styles.empty}>
          <Text style={styles.title}>No publish results</Text>
          <Text style={styles.subtitle}>Publish a listing first to see outcomes here.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Identify')}>
            <Text style={styles.primaryButtonText}>Identify a product</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>
            {failed === 0 ? 'Listing published' : 'Publish results'}
          </Text>
          {report.title ? (
            <Text style={styles.itemTitle}>
              {report.title}
              {report.draftId != null ? ` · Draft #${report.draftId}` : ''}
            </Text>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryPublished}>{published} published</Text>
            <Text style={styles.summaryDryRun}>{dryRun} dry-run</Text>
            <Text style={failed > 0 ? styles.summaryFailed : styles.summaryMuted}>
              {failed} failed
            </Text>
          </View>
        </View>

        {outcomes.map((outcome) => {
          const badge = outcomeLabel(outcome);
          return (
            <View key={outcome.marketplace} style={styles.outcomeCard}>
              <View style={styles.outcomeHeader}>
                <Text style={styles.marketplaceName}>{outcome.marketplace}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              </View>
              <Text style={styles.message}>{outcome.message}</Text>
              {outcome.listingUrl ? (
                <TouchableOpacity
                  onPress={() => void Linking.openURL(outcome.listingUrl!)}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>View live listing</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              navigation.getParent()?.navigate('Listings' as never)
            }
          >
            <Text style={styles.secondaryButtonText}>My listings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Identify')}
          >
            <Text style={styles.primaryButtonText}>List another item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 12 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  headerCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  itemTitle: { fontSize: 14, color: '#6B7280' },
  summaryRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  summaryPublished: { color: '#047857', fontWeight: '600', fontSize: 13 },
  summaryDryRun: { color: '#B45309', fontWeight: '600', fontSize: 13 },
  summaryFailed: { color: '#B91C1C', fontWeight: '600', fontSize: 13 },
  summaryMuted: { color: '#9CA3AF', fontSize: 13 },
  outcomeCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  outcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  marketplaceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'capitalize',
    flex: 1,
  },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  message: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  linkButton: { alignSelf: 'flex-start' },
  linkText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#374151', fontWeight: '600', fontSize: 15 },
});
