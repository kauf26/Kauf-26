import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../config/legal';

async function openLegalUrl(url: string, label: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open link', `${label} URL is not supported on this device.`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Cannot open link', `Failed to open ${label}.`);
  }
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          App preferences and legal information. Update legal URLs in{' '}
          <Text style={styles.mono}>mobile/src/config/legal.ts</Text> after your backend is
          deployed.
        </Text>

        <Text style={styles.sectionHeader}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => void openLegalUrl(PRIVACY_POLICY_URL, 'Privacy Policy')}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Privacy Policy</Text>
              <Text style={styles.linkUrl} numberOfLines={1}>
                {PRIVACY_POLICY_URL}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#6b7280" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => void openLegalUrl(TERMS_OF_SERVICE_URL, 'Terms of Service')}
          >
            <Ionicons name="document-text-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Terms of Service</Text>
              <Text style={styles.linkUrl} numberOfLines={1}>
                {TERMS_OF_SERVICE_URL}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          OAuth marketplace tokens are stored encrypted on the server, not on this device, when
          you connect via Connections.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  mono: { fontFamily: 'Menlo', color: '#d1d5db' },
  sectionHeader: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  linkTextWrap: { flex: 1 },
  linkTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  linkUrl: { color: '#6b7280', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#1f2937' },
  hint: { color: '#6b7280', fontSize: 12, lineHeight: 18, marginTop: 16 },
});
