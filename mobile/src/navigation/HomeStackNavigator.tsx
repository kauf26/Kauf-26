import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import IdentifyScreen from '../screens/IdentifyScreen';
import EditScreen from '../screens/EditScreen';
import type { HomeStackParamList } from '../types/identify';

const Stack = createStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator
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
  );
}
