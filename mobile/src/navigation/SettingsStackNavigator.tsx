import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SettingsScreen from '../screens/SettingsScreen';
import ToolsScreen from '../screens/ToolsScreen';
import SalesScreen from '../screens/SalesScreen';
import SoldProductsScreen from '../screens/SoldProductsScreen';
import HomeScreen from '../screens/HomeScreen';
import type { SettingsStackParamList } from '../types/navigation';

const Stack = createStackNavigator<SettingsStackParamList>();

export default function SettingsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#111827', borderBottomColor: '#1f2937' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold' },
        cardStyle: { backgroundColor: '#0a0a0f' },
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings', headerShown: false }}
      />
      <Stack.Screen name="Tools" component={ToolsScreen} options={{ title: 'Tools' }} />
      <Stack.Screen name="Sales" component={SalesScreen} options={{ title: 'Sales & Fees' }} />
      <Stack.Screen
        name="SoldProducts"
        component={SoldProductsScreen}
        options={{ title: 'Sold Products' }}
      />
      <Stack.Screen
        name="UploadProduct"
        component={HomeScreen}
        options={{ title: 'Upload Product' }}
      />
    </Stack.Navigator>
  );
}
