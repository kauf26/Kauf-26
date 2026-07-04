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
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import type { StackScreenProps } from '@react-navigation/stack';
import { PRIVACY_POLICY_URL } from '../config/legal';
import type { RootStackParamList } from '../types/navigation';
import { devLoginWithPin, fetchDevLoginEnabled } from '../services/devAuth';
import {
  fetchReviewLoginEnabled,
  reviewLogin,
} from '../services/reviewAuth';
import {
  signInWithAppleNative,
  signInWithGoogleMobile,
} from '../services/userAccountAuth';

WebBrowser.maybeCompleteAuthSession();

const LOGO_IMAGE = require('../../assets/img-2482.jpg');

type Props = StackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [loading, setLoading] = useState<'google' | 'apple' | 'dev' | 'review' | null>(null);
  const [devLoginAvailable, setDevLoginAvailable] = useState(false);
  const [reviewLoginAvailable, setReviewLoginAvailable] = useState(false);
  const [devPin, setDevPin] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewPassword, setReviewPassword] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void fetchDevLoginEnabled().then(setDevLoginAvailable);
    void fetchReviewLoginEnabled().then(setReviewLoginAvailable);
    if (Platform.OS === 'ios') {
      void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
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

  const handleReviewLogin = async () => {
    setLoading('review');
    try {
      await reviewLogin(reviewEmail.trim(), reviewPassword);
      Alert.alert('Signed in', 'App Review demo account ready.');
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Sign in failed',
        err instanceof Error ? err.message : 'Invalid credentials'
      );
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    try {
      await signInWithGoogleMobile();
      navigation.goBack();
    } catch (err) {
      if (err instanceof Error && !err.message.includes('cancelled')) {
        Alert.alert('Sign in failed', err.message);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setLoading('apple');
    try {
      if (Platform.OS === 'ios' && appleAvailable) {
        await signInWithAppleNative();
      } else {
        Alert.alert(
          'Sign in with Apple',
          'Native Apple Sign In is required on iOS when Google sign-in is offered.'
        );
        return;
      }
      navigation.goBack();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Apple Sign In failed');
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
          Sign in to sync drafts across devices. Marketplace OAuth tokens stay on this device only.
        </Text>

        {Platform.OS === 'ios' && appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.appleNativeButton}
            onPress={() => void handleApple()}
          />
        ) : Platform.OS === 'ios' ? (
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
        ) : null}

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

        <TouchableOpacity style={styles.skipButton} onPress={() => navigation.goBack()}>
          <Text style={styles.skipText}>Continue without account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.privacyLink}
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        >
          <Text style={styles.privacyText}>Privacy Policy</Text>
        </TouchableOpacity>

        {reviewLoginAvailable ? (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>App Review login</Text>
            <Text style={styles.reviewHint}>
              For Apple reviewers only. Enabled temporarily on the server during review.
            </Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewEmail}
              onChangeText={setReviewEmail}
              placeholder="Review email"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="username"
            />
            <TextInput
              style={styles.reviewInput}
              value={reviewPassword}
              onChangeText={setReviewPassword}
              placeholder="Review password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              textContentType="password"
            />
            <TouchableOpacity
              style={[styles.button, styles.reviewButton]}
              onPress={() => void handleReviewLogin()}
              disabled={
                loading !== null || !reviewEmail.trim() || !reviewPassword
              }
            >
              {loading === 'review' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.reviewButtonText}>Reviewer Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

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
  appleNativeButton: { width: '100%', maxWidth: 320, height: 48 },
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
  privacyLink: { padding: 8 },
  privacyText: { color: '#3b82f6', fontSize: 13, fontWeight: '500' },
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
  reviewBox: {
    width: '100%',
    maxWidth: 320,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    gap: 8,
  },
  reviewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewHint: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111827',
  },
  reviewButton: { backgroundColor: '#2563EB', marginTop: 4 },
  reviewButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
