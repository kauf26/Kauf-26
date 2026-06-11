import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { API_BASE_URL } from '../services/config';

type InventoryRouteParams = { draftId?: number };

type InventorySnapshot = {
  draftId: number;
  quantity: number;
  reserved?: number;
  available?: number;
};

export default function InventoryScreen() {
  const route = useRoute<RouteProp<Record<string, InventoryRouteParams | undefined>, string>>();
  const navigation = useNavigation<any>();
  const initialDraftId = route.params?.draftId;
  const [draftIdInput, setDraftIdInput] = useState(
    initialDraftId != null ? String(initialDraftId) : ''
  );
  const [quantityInput, setQuantityInput] = useState('');
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadInventory = useCallback(async (draftId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/draft/${draftId}`);
      const body = (await res.json().catch(() => ({}))) as InventorySnapshot & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || `Failed to load inventory (${res.status})`);
      }
      setSnapshot(body);
      setQuantityInput(String(body.quantity ?? 0));
    } catch (err) {
      setSnapshot(null);
      Alert.alert(
        'Inventory error',
        err instanceof Error ? err.message : 'Could not load inventory.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialDraftId != null && initialDraftId > 0) {
      void loadInventory(initialDraftId);
    }
  }, [initialDraftId, loadInventory]);

  const handleLoad = () => {
    const draftId = Number(draftIdInput);
    if (!Number.isFinite(draftId) || draftId <= 0) {
      Alert.alert('Invalid draft ID', 'Enter a valid draft ID number.');
      return;
    }
    void loadInventory(draftId);
  };

  const handleSaveQuantity = async () => {
    const draftId = Number(draftIdInput);
    const quantity = Number(quantityInput);
    if (!Number.isFinite(draftId) || draftId <= 0 || !Number.isFinite(quantity) || quantity < 0) {
      Alert.alert('Invalid input', 'Draft ID and quantity must be valid numbers.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/draft/${draftId}/quantity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const body = (await res.json().catch(() => ({}))) as InventorySnapshot & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || `Update failed (${res.status})`);
      }
      setSnapshot(body);
      Alert.alert('Saved', 'Inventory quantity updated.');
    } catch (err) {
      Alert.alert(
        'Update failed',
        err instanceof Error ? err.message : 'Could not update quantity.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>
          View and update stock quantity for a product draft.
        </Text>

        <Text style={styles.label}>Draft ID</Text>
        <TextInput
          style={styles.input}
          value={draftIdInput}
          onChangeText={setDraftIdInput}
          keyboardType="number-pad"
          placeholder="e.g. 42"
          placeholderTextColor="#9CA3AF"
        />

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleLoad}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Load inventory</Text>
          )}
        </TouchableOpacity>

        {snapshot ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Draft #{snapshot.draftId}</Text>
            <Text style={styles.stat}>Quantity: {snapshot.quantity}</Text>
            {snapshot.available != null ? (
              <Text style={styles.statMuted}>Available: {snapshot.available}</Text>
            ) : null}
            {snapshot.reserved != null ? (
              <Text style={styles.statMuted}>Reserved: {snapshot.reserved}</Text>
            ) : null}

            <Text style={[styles.label, { marginTop: 16 }]}>Update quantity</Text>
            <TextInput
              style={styles.input}
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[styles.secondaryButton, saving && styles.buttonDisabled]}
              onPress={() => void handleSaveQuantity()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#2563EB" />
              ) : (
                <Text style={styles.secondaryButtonText}>Save quantity</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() =>
            navigation.getParent()?.navigate('Home', { screen: 'Identify' })
          }
        >
          <Text style={styles.linkText}>Back to Identify</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#2563EB', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  card: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  stat: { fontSize: 15, color: '#111827', fontWeight: '600' },
  statMuted: { fontSize: 13, color: '#6B7280' },
  linkButton: { alignItems: 'center', paddingVertical: 16 },
  linkText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
});
