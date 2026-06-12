import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMarketplaceConnections } from '../hooks/useMarketplaceConnections';
import {
  hydrateUserProfile,
  setMarketplaceOnboardingCompleted,
  syncUserProfileToBackend,
} from '../services/userProfile';
import { nonOAuthStatusMessage, authMethodLabel } from '../services/providerRegistry';
import { usesServerOAuth } from '../services/serverMarketplaceOAuth';
import { CREDENTIALS_NOT_CONFIGURED } from '../services/auth';
import { API_BASE_URL } from '../services/config';

type Props = {
  onComplete: () => void;
};

type Step = 'profile' | 'connections';

export default function MarketplaceOnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const {
    providers,
    statuses,
    loading,
    connectFields,
    profile,
    configWarning,
    oauthNotice,
    setOauthNotice,
    persistProfile,
    updateField,
    handleConnect,
    connectAllSupported,
    connectedCount,
    configuredOAuth,
  } = useMarketplaceConnections();

  useEffect(() => {
    void (async () => {
      const hydrated = await hydrateUserProfile();
      setName(hydrated.name);
      setEmail(hydrated.email);
    })();
  }, []);

  useEffect(() => {
    if (profile.name && !name) setName(profile.name);
    if (profile.email && !email) setEmail(profile.email);
  }, [profile.name, profile.email, name, email]);

  const continueToConnections = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter your name to continue.');
      return;
    }
    setSavingProfile(true);
    try {
      await persistProfile({
        name: name.trim(),
        email: email.trim(),
        sources: profile.sources,
        updatedAt: Date.now(),
      });
      await syncUserProfileToBackend({ name: name.trim(), email: email.trim() });
      setStep('connections');
    } finally {
      setSavingProfile(false);
    }
  };

  const finishOnboarding = async (skipped = false) => {
    setFinishing(true);
    try {
      try {
        await fetch(`${API_BASE_URL}/api/onboarding/complete`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
      } catch {
        // Optional when no server session
      }
      await setMarketplaceOnboardingCompleted(true);
      if (!skipped && connectedCount === 0) {
        Alert.alert(
          'No marketplaces connected',
          'You can connect anytime from the Connections tab.'
        );
      }
      onComplete();
    } finally {
      setFinishing(false);
    }
  };

  if (step === 'profile') {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>Welcome to Kauf26</Text>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            We&apos;ll use this for listings and sync it to your account when signed in.
          </Text>

          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Jane Seller"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.primaryButton, savingProfile && styles.disabled]}
            onPress={() => void continueToConnections()}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue to marketplaces</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => void finishOnboarding(true)}
            disabled={finishing}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Step 2 of 2</Text>
        <Text style={styles.title}>Connect marketplaces</Text>
        <Text style={styles.subtitle}>
          Link the channels you sell on. OAuth keeps tokens secure — we never store your password.
        </Text>

        {configWarning ? (
          <View style={styles.noticeError}>
            <Text style={styles.noticeText}>{configWarning}</Text>
          </View>
        ) : null}

        {oauthNotice ? (
          <View
            style={[
              styles.notice,
              oauthNotice.kind === 'cancel' ? styles.noticeInfo : styles.noticeError,
            ]}
          >
            <Text style={styles.noticeText}>{oauthNotice.message}</Text>
            <TouchableOpacity onPress={() => setOauthNotice(null)}>
              <Text style={styles.dismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <Text style={styles.connectedSummary}>
            {connectedCount} connected · {configuredOAuth.length} available
          </Text>
          <TouchableOpacity onPress={() => void connectAllSupported()}>
            <Text style={styles.link}>Connect all</Text>
          </TouchableOpacity>
        </View>

        {providers
          .filter((p) => p.oauthSupported)
          .map((p) => {
            const st = statuses[p.id];
            const isConnected = st?.ok;
            const fields = connectFields[p.id] ?? {};

            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={[styles.cardTitle, { color: p.color }]}>{p.name}</Text>
                    <Text style={styles.cardMeta}>{authMethodLabel(p.authMethod)}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    {isConnected ? (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                        <Text style={styles.statusOk}>Connected</Text>
                      </>
                    ) : (
                      <Text style={styles.statusOff}>Not connected</Text>
                    )}
                  </View>
                </View>

                {st?.message ? <Text style={styles.cardMessage}>{st.message}</Text> : null}

                {p.requiresShopDomain && !isConnected ? (
                  <TextInput
                    style={styles.input}
                    placeholder="your-store.myshopify.com"
                    placeholderTextColor="#9ca3af"
                    value={fields.shopDomain ?? ''}
                    onChangeText={(v) => updateField(p.id, 'shopDomain', v)}
                    autoCapitalize="none"
                  />
                ) : null}

                {!p.oauthSupported ? (
                  <Text style={styles.cardHint}>
                    {nonOAuthStatusMessage(p.oauthFlow ?? 'api_key')}
                  </Text>
                ) : null}

                {p.oauthSupported && !isConnected ? (
                  <TouchableOpacity
                    style={[
                      styles.connectButton,
                      { backgroundColor: p.configured ? p.color : '#6b7280' },
                    ]}
                    onPress={() => void handleConnect(p)}
                    disabled={loading === p.id || !p.configured}
                  >
                    {loading === p.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.connectButtonText}>
                        {p.configured
                          ? usesServerOAuth(p.id)
                            ? `Connect ${p.name}`
                            : `Connect ${p.name}`
                          : CREDENTIALS_NOT_CONFIGURED}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

        <TouchableOpacity
          style={[styles.primaryButton, finishing && styles.disabled]}
          onPress={() => void finishOnboarding(false)}
          disabled={finishing}
        >
          {finishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Finish setup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => void finishOnboarding(true)}
          disabled={finishing}
        >
          <Text style={styles.skipText}>Skip — connect later in Connections</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6b7280', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipButton: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectedSummary: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  link: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    backgroundColor: '#fafafa',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusOk: { color: '#16a34a', fontWeight: '700', fontSize: 12 },
  statusOff: { color: '#9ca3af', fontWeight: '600', fontSize: 12 },
  cardMessage: { fontSize: 12, color: '#6b7280' },
  cardHint: { fontSize: 12, color: '#9ca3af' },
  connectButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  connectButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  notice: {
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  noticeInfo: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  noticeError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  noticeText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  dismiss: { color: '#2563eb', fontWeight: '600', fontSize: 12 },
});
