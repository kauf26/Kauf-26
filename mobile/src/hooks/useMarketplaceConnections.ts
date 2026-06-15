import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { connectPlatform } from '../services/marketplaceConnect';
import { isOAuthCancelledError } from '../services/oauthErrors';
import { CREDENTIALS_NOT_CONFIGURED, getConnectBlockedReason } from '../services/auth';
import { verifyMarketplace } from '../services/marketplaceClients';
import {
  loadOnboardingProfile,
  mergeProfileFromMarketplace,
  saveOnboardingProfile,
  type OnboardingProfile,
} from '../services/onboardingProfile';
import { loadProviderRegistry } from '../services/providerRegistry';
import {
  fetchServerOAuthConnections,
  disconnectMarketplaceViaServer,
  usesServerOAuth,
} from '../services/serverMarketplaceOAuth';
import {
  deletePlatformTokens,
  hasPlatformTokens,
  loadPlatformTokens,
  loadShopDomain,
} from '../services/secureTokenStore';
import {
  saveLocalUserProfile,
  syncUserProfileToBackend,
} from '../services/userProfile';
import type { ProviderDisplayMeta } from '../types/marketplaceConnect';

export type ConnectFields = Record<
  string,
  { shopDomain?: string; siteUrl?: string; baseUrl?: string }
>;

export function useMarketplaceConnections(options?: {
  onProfileUpdated?: (profile: OnboardingProfile) => void;
}) {
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
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<{
    kind: 'cancel' | 'error';
    message: string;
    platform?: string;
  } | null>(null);

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
          message: p.notes ?? 'API key required',
        };
        continue;
      }

      if (usesServerOAuth(p.id)) {
        const row = serverById.get(p.id);
        if (!row?.configured) {
          next[p.id] = { ok: false, message: CREDENTIALS_NOT_CONFIGURED };
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

      // Legacy on-device tokens (pre-migration) — prefer server status when available
      const serverRow = serverById.get(p.id);
      if (serverRow?.connected) {
        const label = serverRow.accountLabel ?? serverRow.shopDomain ?? 'Connected';
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
      const label = tokens?.userName ?? tokens?.accountName ?? v.accountName ?? v.message;
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
    void refresh();
  }, [refresh]);

  const persistProfile = async (next: OnboardingProfile) => {
    setProfile(next);
    await saveOnboardingProfile(next);
    await saveLocalUserProfile({ name: next.name, email: next.email });
    void syncUserProfileToBackend({ name: next.name, email: next.email });
    setProfileDirty(false);
    options?.onProfileUpdated?.(next);
  };

  const updateField = (id: string, field: keyof ConnectFields[string], value: string) => {
    setConnectFields((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleConnect = async (p: ProviderDisplayMeta, quiet = false) => {
    if (!p.oauthSupported) return false;
    if (!p.configured) {
      if (!quiet) {
        Alert.alert(
          CREDENTIALS_NOT_CONFIGURED,
          getConnectBlockedReason(p.id, false) ??
            `Set ${p.name} client credentials on the server.`
        );
      }
      return false;
    }

    setLoading(p.id);
    setOauthNotice(null);
    const fields = connectFields[p.id] ?? {};

    try {
      const result = await connectPlatform(p.id, fields);
      const merged = await mergeProfileFromMarketplace(result.profile);
      setProfile(merged);
      setProfileDirty(false);
      await persistProfile(merged);

      if (!quiet) {
        Alert.alert(
          `${p.name} connected`,
          [
            result.profile.name ? `Name: ${result.profile.name}` : '',
            result.profile.email ? `Email: ${result.profile.email}` : '',
          ]
            .filter(Boolean)
            .join('\n') || 'Account linked successfully.'
        );
      }
      await refresh();
      return true;
    } catch (err) {
      if (isOAuthCancelledError(err)) {
        setOauthNotice({
          kind: 'cancel',
          platform: p.id,
          message: 'Connection cancelled. Tap Connect to try again.',
        });
        return false;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      setOauthNotice({
        kind: 'error',
        platform: p.id,
        message: `${message} Tap Connect to try again.`,
      });
      return false;
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (usesServerOAuth(id)) {
      await disconnectMarketplaceViaServer(id);
    }
    await deletePlatformTokens(id);
    await refresh();
  };

  const connectAllSupported = async () => {
    const pending = providers.filter((p) => {
      if (!p.oauthSupported || !p.configured) return false;
      return !statuses[p.id]?.ok;
    });
    if (pending.length === 0) {
      Alert.alert('All set', 'Every configured marketplace is already connected.');
      return;
    }
    for (const p of pending) {
      const ok = await handleConnect(p, true);
      if (!ok) break;
    }
  };

  const connectedCount = providers.filter((p) => statuses[p.id]?.ok).length;
  const configuredOAuth = providers.filter((p) => p.oauthSupported && p.configured);

  return {
    providers,
    statuses,
    loading,
    connectFields,
    profile,
    setProfile,
    profileDirty,
    setProfileDirty,
    configWarning,
    oauthNotice,
    setOauthNotice,
    refresh,
    persistProfile,
    updateField,
    handleConnect,
    handleDisconnect,
    connectAllSupported,
    connectedCount,
    configuredOAuth,
  };
}
