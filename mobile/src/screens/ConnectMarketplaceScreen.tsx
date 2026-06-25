import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackScreenProps } from '@react-navigation/stack';
import MarketplaceOAuthWebView from '../components/MarketplaceOAuthWebView';
import { CREDENTIALS_NOT_CONFIGURED, getConnectBlockedReason } from '../services/auth';
import { getOAuthRedirectUri } from '../services/oauthRedirect';
import { startMarketplaceOAuthWebView, type OAuthWebViewSession } from '../services/marketplaceOAuthWebView';
import { disconnectMarketplaceOnDevice } from '../services/serverMarketplaceOAuth';
import {
  deletePlatformTokens,
  hasPlatformTokens,
  loadPlatformTokens,
} from '../services/secureTokenStore';
import { getOAuthProvider } from '../services/oauthConfig';
import { navigateToTab } from '../navigation/navigateToTab';
import type { SettingsStackParamList } from '../types/navigation';

/** Primary marketplaces for seller OAuth — eBay first. */
export const PRIMARY_OAUTH_MARKETPLACES = [
  {
    id: 'ebay',
    name: 'eBay',
    color: '#e53238',
    description: 'List and manage inventory on eBay US.',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    color: '#ff9900',
    description: 'Connect your Amazon Seller Central account (SP-API).',
  },
] as const;

type Props = StackScreenProps<SettingsStackParamList, 'ConnectMarketplace'>;

type MarketplaceStatus = {
  connected: boolean;
  configured: boolean;
  label: string;
};

export default function ConnectMarketplaceScreen({ route, navigation }: Props) {
  const focusId = route.params?.focus;
  const [statuses, setStatuses] = useState<Record<string, MarketplaceStatus>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [webViewSession, setWebViewSession] = useState<OAuthWebViewSession | null>(null);
  const [webViewName, setWebViewName] = useState('');
  const [webViewVisible, setWebViewVisible] = useState(false);

  const refresh = useCallback(async () => {
    const next: Record<string, MarketplaceStatus> = {};
    for (const mp of PRIMARY_OAUTH_MARKETPLACES) {
      const config = await getOAuthProvider(mp.id);
      const connected = await hasPlatformTokens(mp.id);
      const tokens = connected ? await loadPlatformTokens(mp.id) : null;
      next[mp.id] = {
        connected,
        configured: Boolean(config?.configured),
        label: tokens?.userName ?? tokens?.accountName ?? (connected ? 'Connected' : 'Not connected'),
      };
    }
    setStatuses(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const orderedMarketplaces = useMemo(() => {
    if (!focusId) return [...PRIMARY_OAUTH_MARKETPLACES];
    return [...PRIMARY_OAUTH_MARKETPLACES].sort((a, b) => {
      if (a.id === focusId) return -1;
      if (b.id === focusId) return 1;
      return 0;
    });
  }, [focusId]);

  const handleConnect = async (marketplaceId: string, marketplaceName: string) => {
    const config = await getOAuthProvider(marketplaceId);
    if (!config?.configured) {
      Alert.alert(
        CREDENTIALS_NOT_CONFIGURED,
        getConnectBlockedReason(marketplaceId, false) ??
          `Add ${marketplaceName} credentials to the server .env file, then restart npm run server.`
      );
      return;
    }

    setLoadingId(marketplaceId);
    try {
      const session = await startMarketplaceOAuthWebView(marketplaceId);
      setWebViewSession(session);
      setWebViewName(marketplaceName);
      setWebViewVisible(true);
    } catch (err) {
      Alert.alert(
        'Could not start sign-in',
        err instanceof Error ? err.message : 'Unknown error'
      );
    } finally {
      setLoadingId(null);
    }
  };

  const handleDisconnect = async (marketplaceId: string, marketplaceName: string) => {
    Alert.alert(`Disconnect ${marketplaceName}?`, 'Tokens will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnectMarketplaceOnDevice(marketplaceId);
          await deletePlatformTokens(marketplaceId);
          await refresh();
        },
      },
    ]);
  };

  const closeWebView = () => {
    setWebViewVisible(false);
    setWebViewSession(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Connect seller accounts to publish listings. OAuth tokens are stored securely on this
          device only.
        </Text>

        {orderedMarketplaces.map((mp) => {
          const status = statuses[mp.id];
          const isConnected = status?.connected;
          const isConfigured = status?.configured ?? false;
          const isLoading = loadingId === mp.id;
          const redirectUri = getOAuthRedirectUri(mp.id);

          return (
            <View
              key={mp.id}
              style={[styles.card, focusId === mp.id && styles.cardFocused]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: mp.color }]}>
                  <Text style={styles.badgeText}>{mp.name.charAt(0)}</Text>
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{mp.name}</Text>
                  <Text style={styles.cardDescription}>{mp.description}</Text>
                </View>
                {isConnected ? (
                  <View style={styles.connectedPill}>
                    <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                    <Text style={styles.connectedText}>Connected</Text>
                  </View>
                ) : isConfigured ? (
                  <View style={styles.readyPill}>
                    <Text style={styles.readyText}>Ready</Text>
                  </View>
                ) : (
                  <View style={styles.setupPill}>
                    <Text style={styles.setupText}>Setup needed</Text>
                  </View>
                )}
              </View>

              {status ? (
                <Text style={styles.statusLine}>
                  {isConnected ? status.label : isConfigured ? 'Tap Connect to sign in' : CREDENTIALS_NOT_CONFIGURED}
                </Text>
              ) : null}

              <Text style={styles.redirectHint}>Redirect URI: {redirectUri}</Text>

              <View style={styles.actions}>
                {isConnected ? (
                  <>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => void handleConnect(mp.id, mp.name)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#93c5fd" />
                      ) : (
                        <Text style={styles.secondaryBtnText}>Reconnect</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dangerBtn}
                      onPress={() => void handleDisconnect(mp.id, mp.name)}
                    >
                      <Text style={styles.dangerBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryBtn, !isConfigured && styles.primaryBtnDisabled]}
                    onPress={() => void handleConnect(mp.id, mp.name)}
                    disabled={isLoading || !isConfigured}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="log-in-outline" size={18} color="#ffffff" />
                        <Text style={styles.primaryBtnText}>Connect with {mp.name}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigateToTab(navigation, 'Connections')}
        >
          <Ionicons name="link-outline" size={18} color="#93c5fd" />
          <Text style={styles.linkText}>View all 26 marketplace connections</Text>
        </TouchableOpacity>
      </ScrollView>

      <MarketplaceOAuthWebView
        visible={webViewVisible}
        session={webViewSession}
        marketplaceName={webViewName}
        onClose={closeWebView}
        onSuccess={async () => {
          await refresh();
          Alert.alert(`${webViewName} connected`, 'You can now publish to this marketplace.');
        }}
        onError={(message) => {
          if (message !== 'Connection cancelled') {
            Alert.alert('Connection failed', message);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardFocused: {
    borderColor: '#3b82f6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardDescription: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  connectedText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  readyPill: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  readyText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  setupPill: {
    backgroundColor: '#451a03',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  setupText: {
    color: '#fdba74',
    fontSize: 11,
    fontWeight: '700',
  },
  statusLine: {
    color: '#d1d5db',
    fontSize: 13,
    marginTop: 12,
  },
  redirectHint: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  secondaryBtnText: {
    color: '#93c5fd',
    fontWeight: '600',
  },
  dangerBtn: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  dangerBtnText: {
    color: '#fca5a5',
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  linkText: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '600',
  },
});
