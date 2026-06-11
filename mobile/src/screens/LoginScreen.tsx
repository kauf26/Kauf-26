import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { StackScreenProps } from '@react-navigation/stack';
import { API_BASE_URL } from '../services/config';
import type { RootStackParamList } from '../types/navigation';

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
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

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
});
