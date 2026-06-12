import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MobileSale } from '../services/shipping';

type Props = {
  sale: MobileSale;
  onPress: (sale: MobileSale) => void;
  loading?: boolean;
};

/** Opens the full shipping label flow (addresses, rates, expo-print). */
export default function OrderPrintLabelButton({ sale, onPress, loading }: Props) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => onPress(sale)}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <>
          <Ionicons name="print-outline" size={18} color="#ffffff" />
          <Text style={styles.text}>Print Label</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  text: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
});
