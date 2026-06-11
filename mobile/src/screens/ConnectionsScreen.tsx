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
import { CREDENTIALS_NOT_CONFIGURED, getConnectBlockedReason } from '../services/auth';
import { verifyMarketplace } from '../services/marketplaceClients';
import {
  loadOnboardingProfile,
  mergeProfileFromMarketplace,
  saveOnboardingProfile,
  type OnboardingProfile,
} from '../services/onboardingProfile';
import { loadProviderRegistry, nonOAuthStatusMessage } from '../services/providerRegistry';
import {
  connectMarketplaceViaServer,
  disconnectMarketplaceViaServer,
  fetchServerOAuthConnections,
  usesServerOAuth,
} from '../services/serverMarketplaceOAuth';
import {
  deletePlatformTokens,
  hasPlatformTokens,
  loadPlatformTokens,
  loadShopDomain,
} from '../services/secureTokenStore';
import type { ProviderDisplayMeta } from '../types/marketplaceConnect';

type ConnectFields = Record<string, { shopDomain?: string; siteUrl?: string; baseUrl?: string }>;

export default function ConnectionsScreen() {
  const [providers, setProviders] = useState<ProviderDisplayMeta[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [connectFields, setConnectFields] = useState<ConnectFields>({});
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
    platform?: string;
  } | null>(null);
  const [configWarning, setConfigWarning] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    let registry: ProviderDisplayMeta[] = [];
    try {
      const loaded = await loadProviderRegistry();
      registry = loaded.providers;
      setProviders(registry);
      setConfigWarning(loaded.configWarning ?? null);
    } catch {
      setConfigWarning('Could not load marketplace configuration. Check your server connection.');
      return;
    }

    let serverConnections: Awaited<ReturnType<typeof fetchServerOAuthConnections>> = [];
    try {
      serverConnections = await fetchServerOAuthConnections();
    } catch {
      // Backend may be offline during dev startup.
    }
    const serverById = new Map(serverConnections.map((c) => [c.marketplace, c]));

    const next: Record<string, { ok: boolean; message: string }> = {};
    for (const p of registry) {
      if (!p.oauthSupported) {
        next[p.id] = {
          ok: false,
          message: p.notes ?? nonOAuthStatusMessage(p.oauthFlow ?? 'api_key'),
        };
        continue;
      }

      if (usesServerOAuth(p.id)) {
        const row = serverById.get(p.id);
        if (!row?.configured) {
          next[p.id] = {
            ok: false,
            message: CREDENTIALS_NOT_CONFIGURED,
          };
          continue;
        }
        if (!row.connected) {
          next[p.id] = { ok: false, message: 'Not connected' };
          continue;
        }
        const label = row.accountLabel ?? row.shopDomain ?? 'Connected';
        next[p.id] = { ok: true, message: label };
        continue;
      }

      const connected = await hasPlatformTokens(p.id);
      if (!connected) {
        next[p.id] = {
          ok: false,
          message: p.configured ? 'Not connected' : CREDENTIALS_NOT_CONFIGURED,
        };
        continue;
      }
      const tokens = await loadPlatformTokens(p.id);
      const v = await verifyMarketplace(p.id);
      const label =
        tokens?.userName ?? tokens?.accountName ?? v.accountName ?? v.message;
      next[p.id] = { ok: v.ok, message: label };
    }
    setStatuses(next);

    const savedShop = await loadShopDomain();
    if (savedShop) {
      setConnectFields((f) => ({
        ...f,
        shopify: { ...f.shopify, shopDomain: savedShop },
      }));
    }

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

  const updateField = (id: string, field: keyof ConnectFields[string], value: string) => {
    setConnectFields((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleConnect = async (p: ProviderDisplayMeta) => {
    if (!p.oauthSupported) return;
    if (!p.configured) {
      Alert.alert(
        CREDENTIALS_NOT_CONFIGURED,
        getConnectBlockedReason(p.id, false) ??
          `Set ${p.name} client credentials on the server (and mobile/.env secrets if required).`
      );
      return;
    }

    setLoading(p.id);
    setOauthNotice(null);
    const fields = connectFields[p.id] ?? {};
    try {
      if (usesServerOAuth(p.id)) {
        const result = await connectMarketplaceViaServer(p.id, {
          shopDomain: fields.shopDomain,
        });
        if (!result.ok) {
          throw new Error(result.message);
        }
        Alert.alert(`${p.name} connected`, result.message);
        await refresh();
        return;
      }

      const result = await connectPlatform(p.id, fields);
      const merged = await mergeProfileFromMarketplace(result.profile);
      setProfile(merged);
      setProfileDirty(false);

      const tapNote = result.oneTapLikely
        ? 'Connected in one tap using your saved browser session.'
        : 'Connected — you signed in via the system browser.';

      Alert.alert(
        `${p.name} connected`,
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
          platform: p.id,
          message:
            'Connection cancelled. Tap Connect to try again — your password is never stored in this app.',
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      setOauthNotice({
        kind: 'error',
        platform: p.id,
        message: `${message} Tap Connect to try again.`,
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (usesServerOAuth(id)) {
      await disconnectMarketplaceViaServer(id);
    } else {
      await deletePlatformTokens(id);
    }
    await refresh();
  };

  const oauthProviders = providers.filter((p) => p.oauthSupported);
  const otherProviders = providers.filter((p) => !p.oauthSupported);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="flash" size={22} color="#3b82f6" />
          <Text style={styles.heroTitle}>One-tap marketplace connect</Text>
        </View>
        <Text style={styles.subtitle}>{oneTapHelpText()}</Text>

        {configWarning ? (
          <View style={[styles.notice, styles.noticeError]}>
            <Ionicons name="alert-circle-outline" size={18} color="#fca5a5" />
            <Text style={styles.noticeText}>{configWarning}</Text>
            <TouchableOpacity onPress={() => setConfigWarning(null)}>
              <Text style={styles.noticeDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {oauthNotice && (
          <View
            style={[
              styles.notice,
              oauthNotice.kind === 'cancel' ? styles.noticeCancel : styles.noticeError,
            ]}
          >
            <Ionicons
              name={
                oauthNotice.kind === 'cancel'
                  ? 'information-circle-outline'
                  : 'alert-circle-outline'
              }
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
            After you connect, we fetch your name and email from the marketplace API. Edit anytime —
            stored only on this device.
          </Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#6b7280"
            value={profile.name}
            onChangeText={(name) => {
              setProfileDirty(true);
              setProfile((prev) => ({ ...prev, name }));
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
              setProfile((prev) => ({ ...prev, email }));
            }}
            onBlur={() => persistProfile({ ...profile, updatedAt: Date.now() })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {profile.sources.length > 0 && (
            <Text style={styles.sources}>Auto-filled from: {profile.sources.join(', ')}</Text>
          )}
        </View>

        <Text style={styles.groupTitle}>OAuth marketplaces ({oauthProviders.length})</Text>
        {oauthProviders.map((p) => renderProviderCard(p))}

        {otherProviders.length > 0 && (
          <>
            <Text style={[styles.groupTitle, { marginTop: 8 }]}>
              Partnership / API key ({otherProviders.length})
            </Text>
            {otherProviders.map((p) => renderProviderCard(p))}
          </>
        )}

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

  function renderProviderCard(p: ProviderDisplayMeta) {
    const st = statuses[p.id];
    const isConnected = st?.ok;
    const fields = connectFields[p.id] ?? {};

    return (
      <View key={p.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: p.color }]}>{p.name}</Text>
          <Text style={isConnected ? styles.badgeOk : styles.badgeOff}>
            {!p.oauthSupported
              ? 'N/A'
              : isConnected
                ? 'Connected'
                : p.configured
                  ? 'Not connected'
                  : 'Not configured'}
          </Text>
        </View>
        {st?.message ? <Text style={styles.message}>{st.message}</Text> : null}

        {!p.oauthSupported && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#9ca3af" />
            <Text style={styles.infoText}>
              {nonOAuthStatusMessage(p.oauthFlow ?? 'api_key')}
            </Text>
          </View>
        )}

        {p.oauthSupported && p.requiresShopDomain && !isConnected && (
          <>
            <Text style={styles.label}>Store domain</Text>
            <TextInput
              style={styles.input}
              placeholder="your-store.myshopify.com"
              placeholderTextColor="#6b7280"
              value={fields.shopDomain ?? ''}
              onChangeText={(v) => updateField(p.id, 'shopDomain', v)}
              autoCapitalize="none"
            />
          </>
        )}

        {p.oauthSupported && p.requiresSiteUrl && !isConnected && (
          <>
            <Text style={styles.label}>Site URL</Text>
            <TextInput
              style={styles.input}
              placeholder="yourstore.com"
              placeholderTextColor="#6b7280"
              value={fields.siteUrl ?? ''}
              onChangeText={(v) => updateField(p.id, 'siteUrl', v)}
              autoCapitalize="none"
            />
          </>
        )}

        {p.oauthSupported && p.requiresBaseUrl && !isConnected && (
          <>
            <Text style={styles.label}>Store base URL</Text>
            <TextInput
              style={styles.input}
              placeholder="store.example.com"
              placeholderTextColor="#6b7280"
              value={fields.baseUrl ?? ''}
              onChangeText={(v) => updateField(p.id, 'baseUrl', v)}
              autoCapitalize="none"
            />
          </>
        )}

        <View style={styles.actions}>
          {p.oauthSupported && !isConnected ? (
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: p.configured ? p.color : '#4b5563' },
              ]}
              onPress={() => handleConnect(p)}
              disabled={loading === p.id || !p.configured}
            >
              {loading === p.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonInner}>
                  <Ionicons name="flash-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>
                    {p.configured
                      ? usesServerOAuth(p.id)
                        ? `Connect ${p.name}`
                        : `Connect ${p.name} — one tap`
                      : CREDENTIALS_NOT_CONFIGURED}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : p.oauthSupported && isConnected ? (
            <TouchableOpacity style={styles.disconnect} onPress={() => handleDisconnect(p.id)}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  groupTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  noticeCancel: { backgroundColor: '#1e3a5f40', borderColor: '#3b82f650' },
  noticeError: { backgroundColor: '#450a0a40', borderColor: '#ef444450' },
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
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  badgeOk: { color: '#10b981', fontSize: 11, fontWeight: '600' },
  badgeOff: { color: '#f87171', fontSize: 11, fontWeight: '600' },
  message: { color: '#d1d5db', fontSize: 12, marginTop: 6 },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1f293780',
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoText: { flex: 1, color: '#9ca3af', fontSize: 12, lineHeight: 17 },
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
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  disconnect: { paddingVertical: 10, alignItems: 'center' },
  disconnectText: { color: '#f87171', fontWeight: '600' },
  footerNote: { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
