import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import MainNavigator from './src/navigation/MainNavigator';
import PinAuthScreen from './src/screens/PinAuthScreen';
import SoldItemAlertMobile from './src/components/SoldItemAlertMobile';
import { wireOAuthSessionLifecycle } from './src/services/oauthSessionLifecycle';

WebBrowser.maybeCompleteAuthSession();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3b82f6',
    background: '#0a0a0f',
    card: '#111827',
    text: '#ffffff',
    border: '#1f2937',
    notification: '#3b82f6',
  },
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPin();
  }, []);

  useEffect(() => {
    return wireOAuthSessionLifecycle();
  }, []);

  const checkPin = async () => {
    try {
      const storedPin = await SecureStore.getItemAsync('userPin');
      setHasPin(!!storedPin);
    } catch (error) {
      setHasPin(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthenticate = () => {
    setIsAuthenticated(true);
  };

  const handlePinSet = () => {
    setHasPin(true);
    setIsAuthenticated(true);
  };

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <PinAuthScreen
          hasPin={hasPin || false}
          onAuthenticate={handleAuthenticate}
          onPinSet={handlePinSet}
        />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <MainNavigator />
        <SoldItemAlertMobile />
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
