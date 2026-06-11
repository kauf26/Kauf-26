import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import PinAuthScreen from './src/screens/PinAuthScreen';
import RootNavigator from './src/navigation/RootNavigator';

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2563eb',
    background: '#ffffff',
    card: '#ffffff',
    text: '#18181b',
    border: '#e5e7eb',
    notification: '#2563eb',
  },
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinAuthenticated, setPinAuthenticated] = useState(false);

  useEffect(() => {
    void (async () => {
      const storedPin = await SecureStore.getItemAsync('userPin');
      setHasPin(Boolean(storedPin));
      setBooting(false);
    })();
  }, []);

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!pinAuthenticated) {
    return (
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaProvider>
          <PinAuthScreen
            hasPin={hasPin}
            onAuthenticate={() => setPinAuthenticated(true)}
            onPinSet={() => {
              setHasPin(true);
              setPinAuthenticated(true);
            }}
          />
          <StatusBar style="light" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <NavigationContainer theme={AppTheme}>
          <RootNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
