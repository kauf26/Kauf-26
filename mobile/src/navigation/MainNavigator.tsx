import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeStackNavigator from './HomeStackNavigator';
import ListingsScreen from '../screens/ListingsScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ConnectionsScreen from '../screens/ConnectionsScreen';
import SettingsStackNavigator from './SettingsStackNavigator';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof MainTabParamList, { focused: TabIconName; default: TabIconName }> = {
  Home: { focused: 'home', default: 'home-outline' },
  Connections: { focused: 'link', default: 'link-outline' },
  Listings: { focused: 'list', default: 'list-outline' },
  Inventory: { focused: 'layers', default: 'layers-outline' },
  Settings: { focused: 'settings', default: 'settings-outline' },
};

export default function MainNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof MainTabParamList];
          const iconName = focused ? icons.focused : icons.default;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#1f2937',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#111827',
          borderBottomColor: '#1f2937',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{ title: 'Home', headerShown: false }}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{ title: 'Connections' }}
      />
      <Tab.Screen
        name="Listings"
        component={ListingsScreen}
        options={{ title: 'Listings' }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: 'Inventory' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{ title: 'Settings', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
