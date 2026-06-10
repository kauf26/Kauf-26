import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { connectPlatform, oneTapHelpText } from '../services/marketplaceConnect';
import { isOAuthCancelledError } from '../services/oauthErrors';
import { verifyMarketplace } from '../services/marketplaceClients';
import {
  loadOnboardingProfile,
  mergeProfileFromMarketplace,
  saveOnboardingProfile,
  type OnboardingProfile,
} from '../services/onboardingProfile';
import {
  deletePlatformTokens,
  hasPlatformTokens,
  loadPlatformTokens,
  loadShopDomain,
} from '../services/secureTokenStore';
import type { OAuthPlatform } from '../types/marketplaceConnect';

const PLATFORMS: { id: OAuthPlatform; name: string; color: string }[] = [
  { id: 'etsy', name: 'Etsy', color: '#f45800' },
  { id: 'shopify', name: 'Shopify', color: '#95bf47' },
  { id: 'ebay', name: 'eBay', color: '#e53238' },
];

export default function ConnectionsScreen() {
  const [statuses, setStatuses] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [shopifyShop, setShopifyShop] = useState('');
  const [profile, setProfile] = useState<OnboardingProfile>({
    name: '',
    email: '',
    sources: [],
    updatedAt: 0,
  });
  const [profileDirty, setProfileDirty] = useState(false);
  const [oauthNotice, setOauthNotice] = useState<{
    kind: 'cancel' | 'error';
    message: string;
    platform?: OAuthPlatform;
  } | null>(null);

  const refresh = useCallback(async () => {
    const next: Record<string, { ok: boolean; message: string }> = {};
    for (const p of PLATFORMS) {
      const connected = await hasPlatformTokens(p.id);
      if (!connected) {
        next[p.id] = { ok: false, message: 'Not connected' };
        continue;
      }
      const tokens = await loadPlatformTokens(p.id);
      const v = await verifyMarketplace(p.id);
      const label =
        tokens?.userName ??
        tokens?.accountName ??
        v.accountName ??
        v.message;
      next[p.id] = { ok: v.ok, message: label };
    }
    setStatuses(next);
    const savedShop = await loadShopDomain();
    if (savedShop) setShopifyShop(savedShop);

    if (!profileDirty) {
      const saved = await loadOnboardingProfile();
      if (saved) setProfile(saved);
    }
  }, [profileDirty]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persistProfile = async (next: OnboardingProfile) => {
    setProfile(next);
    await saveOnboardingProfile(next);
    setProfileDirty(false);
  };

  const handleConnect = async (id: OAuthPlatform) => {
    setLoading(id);
    setOauthNotice(null);
    try {
      const result = await connectPlatform(id, id === 'shopify' ? shopifyShop : undefined);
      const merged = await mergeProfileFromMarketplace(result.profile);
      setProfile(merged);
      setProfileDirty(false);

      const tapNote = result.oneTapLikely
        ? 'Connected in one tap using your saved browser session.'
        : 'Connected — you signed in via the system browser.';

      Alert.alert(
        `${PLATFORMS.find((p) => p.id === id)?.name} connected`,
        [
          tapNote,
          result.profile.name ? `Name: ${result.profile.name}` : '',
          result.profile.email ? `Email: ${result.profile.email}` : '',
          'Profile fields below were updated (you can edit them).',
        ]
          .filter(Boolean)
          .join('\n')
      );
      await refresh();
    } catch (err) {
      if (isOAuthCancelledError(err)) {
        setOauthNotice({
          kind: 'cancel',
          platform: id,
          message:
            'Sign-in was cancelled. Tap Connect again when you are ready — your password is never stored in this app.',
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      setOauthNotice({
        kind: 'error',
        platform: id,
        message: `${message} Tap Connect to try again.`,
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    await deletePlatformTokens(id);
    await refresh();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="flash" size={22} color="#3b82f6" />
          <Text style={styles.heroTitle}>One-tap marketplace connect</Text>
        </View>
        <Text style={styles.subtitle}>{oneTapHelpText()}</Text>

        {oauthNotice && (
          <View
            style={[
              styles.notice,
              oauthNotice.kind === 'cancel' ? styles.noticeCancel : styles.noticeError,
            ]}
          >
            <Ionicons
              name={oauthNotice.kind === 'cancel' ? 'information-circle-outline' : 'alert-circle-outline'}
              size={18}
              color={oauthNotice.kind === 'cancel' ? '#93c5fd' : '#fca5a5'}
            />
            <Text style={styles.noticeText}>{oauthNotice.message}</Text>
            <TouchableOpacity onPress={() => setOauthNotice(null)}>
              <Text style={styles.noticeDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.profileCard}>
          <Text style={styles.sectionTitle}>Your profile (auto-filled from OAuth)</Text>
          <Text style={styles.sectionHint}>
            After you connect, we fetch your name and email from the marketplace API and fill these
            fields. Edit anytime — stored only on this device.
          </Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#6b7280"
            value={profile.name}
            onChangeText={(name) => {
              setProfileDirty(true);
              setProfile((p) => ({ ...p, name }));
            }}
            onBlur={() => persistProfile({ ...profile, updatedAt: Date.now() })}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#6b7280"
            value={profile.email}
            onChangeText={(email) => {
              setProfileDirty(true);
              setProfile((p) => ({ ...p, email }));
            }}
            onBlur={() => persistProfile({ ...profile, updatedAt: Date.now() })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {profile.sources.length > 0 && (
            <Text style={styles.sources}>
              Auto-filled from: {profile.sources.join(', ')}
            </Text>
          )}
        </View>

        {PLATFORMS.map((p) => {
          const st = statuses[p.id];
          const isConnected = st?.ok;
          return (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: p.color }]}>{p.name}</Text>
                <Text style={isConnected ? styles.badgeOk : styles.badgeOff}>
                  {isConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
              {st?.message ? <Text style={styles.message}>{st.message}</Text> : null}

              {p.id === 'shopify' && !isConnected && (
                <>
                  <Text style={styles.label}>Store domain (required once)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="your-store.myshopify.com"
                    placeholderTextColor="#6b7280"
                    value={shopifyShop}
                    onChangeText={setShopifyShop}
                    autoCapitalize="none"
                  />
                </>
              )}

              <View style={styles.actions}>
                {!isConnected ? (
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: p.color }]}
                    onPress={() => handleConnect(p.id)}
                    disabled={loading === p.id}
                  >
                    {loading === p.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={styles.buttonInner}>
                        <Ionicons name="flash-outline" size={18} color="#fff" />
                        <Text style={styles.buttonText}>Connect {p.name} — one tap</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.disconnect} onPress={() => handleDisconnect(p.id)}>
                    <Text style={styles.disconnectText}>Disconnect</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <Text style={styles.footerNote}>
          {Platform.OS === 'ios'
            ? 'Powered by ASWebAuthenticationSession + SecureStore (Keychain).'
            : Platform.OS === 'android'
              ? 'Powered by Chrome Custom Tabs + SecureStore (Keystore).'
              : 'Tokens stored in SecureStore on this device.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  noticeCancel: {
    backgroundColor: '#1e3a5f40',
    borderColor: '#3b82f650',
  },
  noticeError: {
    backgroundColor: '#450a0a40',
    borderColor: '#ef444450',
  },
  noticeText: { flex: 1, color: '#e5e7eb', fontSize: 13, lineHeight: 18 },
  noticeDismiss: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  profileCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3b82f640',
    marginBottom: 16,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  sectionHint: { color: '#9ca3af', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  sources: { color: '#6b7280', fontSize: 12, marginTop: 8 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  badgeOk: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  badgeOff: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  message: { color: '#d1d5db', fontSize: 13, marginTop: 8 },
  label: { color: '#fff', fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
  },
  actions: { marginTop: 12 },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  disconnect: { paddingVertical: 10, alignItems: 'center' },
  disconnectText: { color: '#f87171', fontWeight: '600' },
  footerNote: { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
