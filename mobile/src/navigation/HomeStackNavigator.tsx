import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import IdentifyScreen from '../screens/IdentifyScreen';
import EditScreen from '../screens/EditScreen';
import SelectMarketplacesScreen from '../screens/SelectMarketplacesScreen';
import PublishConfirmationScreen from '../screens/PublishConfirmationScreen';
import InventoryScreen from '../screens/InventoryScreen';
import type { HomeStackParamList } from '../types/navigation';

const Stack = createStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
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
        name="Identify"
        component={IdentifyScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Edit"
        component={EditScreen}
        options={{ title: 'Product Draft' }}
      />
      <Stack.Screen
        name="SelectMarketplaces"
        component={SelectMarketplacesScreen}
        options={{ title: 'Select Marketplaces' }}
      />
      <Stack.Screen
        name="PublishConfirmation"
        component={PublishConfirmationScreen}
        options={{ title: 'Publish Results', headerLeft: () => null }}
      />
      <Stack.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: 'Inventory' }}
      />
    </Stack.Navigator>
  );
}
