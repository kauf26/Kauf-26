import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../config/legal';
import {
  getAutoTranslateEnabled,
  setAutoTranslateEnabled,
} from '../services/translationPrefs';
import {
  disableBiometricAuth,
  enableBiometricAuth,
  getBiometricCapability,
  getStoredPin,
  isBiometricEnabled,
  type BiometricCapability,
} from '../auth/biometric';
import {
  isRequiresAuthForPublish,
  setRequiresAuthForPublish,
} from '../auth/publishAuth';

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
  const navigation = useNavigation<any>();
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [biometricCap, setBiometricCap] = useState<BiometricCapability | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [requirePublishAuth, setRequirePublishAuth] = useState(true);

  useEffect(() => {
    void getAutoTranslateEnabled().then(setAutoTranslate);
    void (async () => {
      const [enabled, cap, publishAuth] = await Promise.all([
        isBiometricEnabled(),
        getBiometricCapability(),
        isRequiresAuthForPublish(),
      ]);
      setBiometricOn(enabled);
      setBiometricCap(cap);
      setRequirePublishAuth(publishAuth);
    })();
  }, []);

  const onToggleAutoTranslate = (value: boolean) => {
    setAutoTranslate(value);
    void setAutoTranslateEnabled(value);
  };

  const onToggleBiometric = async (value: boolean) => {
    if (biometricBusy) return;

    if (!biometricCap?.available || !biometricCap.enrolled) {
      Alert.alert(
        'Biometrics unavailable',
        biometricCap?.available
          ? `Enroll ${biometricCap.label} in your device Settings first.`
          : 'This device does not support biometric authentication.'
      );
      return;
    }

    setBiometricBusy(true);
    try {
      if (value) {
        const pin = await getStoredPin();
        if (!pin) {
          Alert.alert('PIN required', 'Set up your app PIN before enabling biometrics.');
          return;
        }
        const result = await enableBiometricAuth(pin);
        if (result.ok) {
          setBiometricOn(true);
        } else if (result.error !== 'Cancelled') {
          Alert.alert('Could not enable biometrics', result.error);
        }
      } else {
        await disableBiometricAuth();
        setBiometricOn(false);
      }
    } finally {
      setBiometricBusy(false);
    }
  };

  const biometricLabel = biometricCap?.label ?? 'Biometrics';
  const biometricAvailable = Boolean(biometricCap?.available && biometricCap?.enrolled);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          App preferences and legal information. Set{' '}
          <Text style={styles.mono}>EXPO_PUBLIC_WEB_BASE_URL</Text> (or{' '}
          <Text style={styles.mono}>EXPO_PUBLIC_PRIVACY_URL</Text> /{' '}
          <Text style={styles.mono}>EXPO_PUBLIC_TERMS_URL</Text>) before production EAS builds.
        </Text>

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.getParent()?.getParent()?.navigate('Login')}
          >
            <Ionicons name="log-in-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Sign in</Text>
              <Text style={styles.linkHint}>Google or Apple account (web OAuth)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>{biometricLabel} unlock</Text>
              <Text style={styles.linkHint}>
                {biometricAvailable
                  ? `Use ${biometricLabel} instead of your PIN when opening the app. PIN remains available as fallback.`
                  : biometricCap?.available
                    ? `Enroll ${biometricLabel} in device Settings to enable.`
                    : 'Biometric authentication is not available on this device.'}
              </Text>
            </View>
            <Switch
              value={biometricOn}
              onValueChange={(v) => void onToggleBiometric(v)}
              disabled={!biometricAvailable || biometricBusy}
              trackColor={{ false: '#374151', true: '#2563eb' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Require auth before publish</Text>
              <Text style={styles.linkHint}>
                Face ID, Touch ID, or PIN before sending listings to marketplaces (recommended).
              </Text>
            </View>
            <Switch
              value={requirePublishAuth}
              onValueChange={(v) => {
                setRequirePublishAuth(v);
                void setRequiresAuthForPublish(v);
              }}
              trackColor={{ false: '#374151', true: '#2563eb' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Listing</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Auto-translate listings</Text>
              <Text style={styles.linkHint}>
                Translate title and description to the target marketplace language after photo
                identification (requires LibreTranslate on the server).
              </Text>
            </View>
            <Switch
              value={autoTranslate}
              onValueChange={onToggleAutoTranslate}
              trackColor={{ false: '#374151', true: '#2563eb' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Inventory & tools</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.getParent()?.navigate('Inventory')}
          >
            <Ionicons name="layers-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Manage inventory</Text>
              <Text style={styles.linkHint}>View and update draft stock quantities</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Tools')}
          >
            <Ionicons name="construct-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Tools</Text>
              <Text style={styles.linkHint}>Currency converter, shipping calculator, and more</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('UploadProduct')}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Upload product</Text>
              <Text style={styles.linkHint}>Manual product upload flow</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Sales')}
          >
            <Ionicons name="cash-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Sales & fees</Text>
              <Text style={styles.linkHint}>Track sales and marketplace fees</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('SoldProducts')}
          >
            <Ionicons name="cube-outline" size={20} color="#3b82f6" />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Sold products</Text>
              <Text style={styles.linkHint}>View completed sales history</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  linkTextWrap: { flex: 1 },
  linkTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  linkHint: { color: '#6b7280', fontSize: 12, lineHeight: 17 },
  linkUrl: { color: '#6b7280', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#1f2937' },
  hint: { color: '#6b7280', fontSize: 12, lineHeight: 18, marginTop: 16 },
});
