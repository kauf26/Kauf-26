import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainNavigator from './MainNavigator';
import LoginScreen from '../screens/LoginScreen';
import type { RootStackParamList } from '../types/navigation';

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#18181b',
        headerTitleStyle: { fontWeight: 'bold' },
        cardStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Sign In', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
