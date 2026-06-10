import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import ListingsScreen from '../screens/ListingsScreen';
import SoldProductsScreen from '../screens/SoldProductsScreen';
import SalesScreen from '../screens/SalesScreen';
import ConnectionsScreen from '../screens/ConnectionsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ToolsScreen from '../screens/ToolsScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Listings') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'SoldProducts') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Sales') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'Connections') {
            iconName = focused ? 'link' : 'link-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'Tools') {
            iconName = focused ? 'construct' : 'construct-outline';
          } else {
            iconName = 'ellipse';
          }

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
        component={HomeScreen}
        options={{ title: 'Upload Product' }}
      />
      <Tab.Screen 
        name="Listings" 
        component={ListingsScreen}
        options={{ title: 'My Listings' }}
      />
      <Tab.Screen
        name="SoldProducts"
        component={SoldProductsScreen}
        options={{ title: 'Sold Products' }}
      />
      <Tab.Screen 
        name="Sales" 
        component={SalesScreen}
        options={{ title: 'Sales & Fees' }}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{ title: 'Connections' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Tab.Screen 
        name="Tools" 
        component={ToolsScreen}
        options={{ title: 'Tools' }}
      />
    </Tab.Navigator>
  );
}
