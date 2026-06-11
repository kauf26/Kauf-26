import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import IdentifyScreen from './src/screens/IdentifyScreen';
import EditScreen from './src/screens/EditScreen';
import type { HomeStackParamList } from './src/types/identify';

const Stack = createStackNavigator<HomeStackParamList>();

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
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          initialRouteName="Identify"
          screenOptions={{
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: 'bold' },
            cardStyle: { backgroundColor: '#0a0a0f' },
          }}
        >
          <Stack.Screen
            name="Identify"
            component={IdentifyScreen}
            options={{ title: 'Identify Product' }}
          />
          <Stack.Screen
            name="Edit"
            component={EditScreen}
            options={{ title: 'Review Listing' }}
          />
        </Stack.Navigator>
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
