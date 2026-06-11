import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import IdentifyScreen from './src/screens/IdentifyScreen';
import EditScreen from './src/screens/EditScreen';
import type { HomeStackParamList } from './src/types/identify';

const Stack = createStackNavigator<HomeStackParamList>();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2563eb',
    background: '#ffffff',
    card: '#18181b',
    text: '#18181b',
    border: '#e5e7eb',
    notification: '#2563eb',
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <NavigationContainer theme={AppTheme}>
        <Stack.Navigator
          initialRouteName="Identify"
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#18181b',
            headerTitleStyle: { fontWeight: 'bold' },
            cardStyle: { backgroundColor: '#ffffff' },
          }}
        >
          <Stack.Screen
            name="Identify"
            component={IdentifyScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Edit"
            component={EditScreen}
            options={{ title: 'Product Draft' }}
          />
        </Stack.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
