import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  authenticateWithBiometric,
  getBiometricCapability,
  isBiometricEnabled,
  promptBiometricUnlock,
} from '../auth/biometric';
import { authenticateForPublish } from '../auth/publishAuth';

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function PublishPinModal({
  visible,
  title = 'Confirm to publish',
  subtitle = 'Use Face ID / Touch ID or enter your PIN',
  onSuccess,
  onCancel,
}: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');

  React.useEffect(() => {
    if (!visible) {
      setPin('');
      setError(null);
      setBusy(false);
      return;
    }
    void (async () => {
      const cap = await getBiometricCapability();
      setBioLabel(cap.label);
      const enabled = await isBiometricEnabled();
      if (enabled && cap.enrolled) {
        setBusy(true);
        const result = await authenticateWithBiometric();
        setBusy(false);
        if (result.ok) {
          onSuccess();
        }
      }
    })();
  }, [visible, onSuccess]);

  const tryBiometric = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await promptBiometricUnlock();
      if (result.ok) {
        onSuccess();
        return;
      }
      if (!result.cancelled) {
        setError(result.error ?? 'Biometric verification failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDigit = async (digit: string) => {
    if (busy) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length < 4) return;

    setBusy(true);
    const result = await authenticateForPublish(next);
    setBusy(false);
    if (result.ok) {
      onSuccess();
      return;
    }
    setError(result.error ?? 'Incorrect PIN');
    setPin('');
  };

  const handleBackspace = () => {
    if (busy) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={12}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.dot, pin.length > i && styles.dotFilled]}
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color="#2563eb" style={styles.spinner} /> : null}

          <TouchableOpacity style={styles.bioButton} onPress={() => void tryBiometric()}>
            <Ionicons name="finger-print" size={18} color="#2563eb" />
            <Text style={styles.bioText}>Use {bioLabel}</Text>
          </TouchableOpacity>

          <View style={styles.pad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
              if (key === '') return <View key="spacer" style={styles.keyEmpty} />;
              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key="del"
                    style={styles.key}
                    onPress={handleBackspace}
                    disabled={busy}
                  >
                    <Ionicons name="backspace-outline" size={22} color="#111827" />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.key}
                  onPress={() => void handleDigit(key)}
                  disabled={busy}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  subtitle: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 8 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  dotFilled: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  error: { color: '#dc2626', textAlign: 'center', fontSize: 13 },
  spinner: { marginVertical: 4 },
  bioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  bioText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  key: {
    width: 72,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { width: 72, height: 56 },
  keyText: { fontSize: 22, fontWeight: '600', color: '#111827' },
});
