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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { connectMarketplace } from '../services/marketplaceOAuth';
import { verifyMarketplace } from '../services/marketplaceClients';
import {
  deletePlatformTokens,
  hasPlatformTokens,
  loadShopDomain,
} from '../services/secureTokenStore';

const PLATFORMS = [
  { id: 'etsy' as const, name: 'Etsy', color: '#f45800' },
  { id: 'shopify' as const, name: 'Shopify', color: '#95bf47' },
  { id: 'ebay' as const, name: 'eBay', color: '#e53238' },
];

export default function ConnectionsScreen() {
  const [statuses, setStatuses] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [shopifyShop, setShopifyShop] = useState('');

  const refresh = useCallback(async () => {
    const next: Record<string, { ok: boolean; message: string }> = {};
    for (const p of PLATFORMS) {
      const connected = await hasPlatformTokens(p.id);
      if (!connected) {
        next[p.id] = { ok: false, message: 'Not connected' };
        continue;
      }
      const v = await verifyMarketplace(p.id);
      next[p.id] = { ok: v.ok, message: v.accountName ?? v.message };
    }
    setStatuses(next);
    const savedShop = await loadShopDomain();
    if (savedShop) setShopifyShop(savedShop);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConnect = async (id: 'etsy' | 'shopify' | 'ebay') => {
    setLoading(id);
    try {
      await connectMarketplace(id, id === 'shopify' ? shopifyShop : undefined);
      Alert.alert('Connected', `${id} account linked. Tokens saved in SecureStore.`);
      await refresh();
    } catch (err) {
      Alert.alert('Connection failed', err instanceof Error ? err.message : 'Unknown error');
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
        <Text style={styles.subtitle}>
          OAuth runs in the system browser. Tokens are stored in SecureStore (Keychain / Keystore) and never sent to the server.
        </Text>

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
                  <Text style={styles.label}>Store domain</Text>
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
                      <Text style={styles.buttonText}>Connect with {p.name}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.disconnect}
                    onPress={() => handleDisconnect(p.id)}
                  >
                    <Text style={styles.disconnectText}>Disconnect</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, gap: 16 },
  subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
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
  button: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  disconnect: { paddingVertical: 10, alignItems: 'center' },
  disconnectText: { color: '#f87171', fontWeight: '600' },
});
