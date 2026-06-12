import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { StackScreenProps } from '@react-navigation/stack';
import { API_BASE_URL } from '../services/config';
import type { RootStackParamList } from '../types/navigation';
import { devLoginWithPin, fetchDevLoginEnabled } from '../services/devAuth';

WebBrowser.maybeCompleteAuthSession();

const LOGO_IMAGE = require('../../assets/img-2482.jpg');

type Props = StackScreenProps<RootStackParamList, 'Login'>;

async function openOAuth(path: '/api/auth/google' | '/api/auth/apple') {
  const authUrl = `${API_BASE_URL}${path}`;
  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, 'kauf26://');
    if (result.type === 'success') {
      Alert.alert(
        'Sign in started',
        'Complete sign-in in the browser. Your session is tied to the web app cookie when using the same device browser profile.'
      );
    }
  } catch {
    Alert.alert('Sign in failed', 'Could not open the sign-in page. Check your server connection.');
  }
}

export default function LoginScreen({ navigation }: Props) {
  const [loading, setLoading] = useState<'google' | 'apple' | 'dev' | null>(null);
  const [devLoginAvailable, setDevLoginAvailable] = useState(false);
  const [devPin, setDevPin] = useState('');

  useEffect(() => {
    void fetchDevLoginEnabled().then(setDevLoginAvailable);
  }, []);

  const handleDevLogin = async () => {
    setLoading('dev');
    try {
      await devLoginWithPin(devPin.trim());
      Alert.alert('Dev login', 'Signed in as dev@localhost (mock session saved on device).');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Dev login failed', err instanceof Error ? err.message : 'Invalid PIN');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    try {
      await openOAuth('/api/auth/google');
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setLoading('apple');
    try {
      await openOAuth('/api/auth/apple');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <View style={styles.content}>
        <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>KAUF-AI</Text>
        <Text style={styles.subtitle}>
          Sign in to sync listings and marketplace connections with your account.
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={() => void handleGoogle()}
          disabled={loading !== null}
        >
          {loading === 'google' ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={styles.googleText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.appleButton]}
          onPress={() => void handleApple()}
          disabled={loading !== null}
        >
          {loading === 'apple' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.appleText}>Continue with Apple</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={() => navigation.goBack()}>
          <Text style={styles.skipText}>Continue without account</Text>
        </TouchableOpacity>

        {devLoginAvailable ? (
          <View style={styles.devBox}>
            <Text style={styles.devTitle}>Development only</Text>
            <Text style={styles.devHint}>
              MOCK_OAUTH_MODE is on. Dev PIN grants a mock server session.
            </Text>
            <TextInput
              style={styles.devInput}
              value={devPin}
              onChangeText={setDevPin}
              placeholder="Dev PIN"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.button, styles.devButton]}
              onPress={() => void handleDevLogin()}
              disabled={loading !== null || !devPin.trim()}
            >
              {loading === 'dev' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.devButtonText}>Dev Login</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: { width: 120, height: 120 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  button: {
    width: '100%',
    maxWidth: 320,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleText: { color: '#111827', fontSize: 16, fontWeight: '600' },
  appleButton: { backgroundColor: '#111827' },
  appleText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  skipButton: { marginTop: 8, padding: 12 },
  skipText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  devBox: {
    width: '100%',
    maxWidth: 320,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    gap: 8,
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devHint: { fontSize: 12, color: '#78716C', lineHeight: 16 },
  devInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111827',
  },
  devButton: { backgroundColor: '#B45309', marginTop: 4 },
  devButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
