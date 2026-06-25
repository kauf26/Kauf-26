import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import type { OAuthWebViewSession } from '../services/marketplaceOAuthWebView';
import {
  completeMarketplaceOAuthWebView,
  parseOAuthWebViewCallback,
} from '../services/marketplaceOAuthWebView';
import { OAuthCancelledError } from '../services/oauthErrors';
import type { ConnectResult } from '../types/marketplaceConnect';

type Props = {
  visible: boolean;
  session: OAuthWebViewSession | null;
  marketplaceName: string;
  onClose: () => void;
  onSuccess: (result: ConnectResult) => void;
  onError: (message: string) => void;
};

export default function MarketplaceOAuthWebView({
  visible,
  session,
  marketplaceName,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const [loading, setLoading] = useState(true);
  const completingRef = useRef(false);

  const handleNavigation = async (navState: WebViewNavigation) => {
    if (!session || completingRef.current || !navState.url) return;

    try {
      const parsed = parseOAuthWebViewCallback(navState.url, session.redirectUri);
      if (parsed.cancelled) {
        onClose();
        onError('Connection cancelled');
        return;
      }
      if (!parsed.code) return;

      completingRef.current = true;
      setLoading(true);
      const result = await completeMarketplaceOAuthWebView(session, parsed.code);
      onSuccess(result);
      onClose();
    } catch (err) {
      completingRef.current = false;
      setLoading(false);
      if (err instanceof OAuthCancelledError) {
        onClose();
        onError('Connection cancelled');
        return;
      }
      onError(err instanceof Error ? err.message : 'OAuth failed');
    }
  };

  const reset = () => {
    completingRef.current = false;
    setLoading(true);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={reset}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>Connect {marketplaceName}</Text>
          <View style={styles.closeBtn} />
        </View>

        {session ? (
          <View style={styles.webWrap}>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading sign-in…</Text>
              </View>
            ) : null}
            <WebView
              source={{ uri: session.authorizationUrl }}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onNavigationStateChange={handleNavigation}
              onShouldStartLoadWithRequest={(request) => {
                void handleNavigation({ url: request.url } as WebViewNavigation);
                return !request.url.startsWith('kauf26://');
              }}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              javaScriptEnabled
              domStorageEnabled
              style={styles.webview}
            />
          </View>
        ) : (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}

        <Text style={styles.footer}>
          Sign in with your {marketplaceName} seller account. Tokens stay on this device only.
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  webWrap: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
    zIndex: 2,
  },
  loadingText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
});
