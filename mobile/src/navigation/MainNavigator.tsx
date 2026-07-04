import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeStackNavigator from './HomeStackNavigator';
import ListingsScreen from '../screens/ListingsScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ConnectionsScreen from '../screens/ConnectionsScreen';
import SettingsStackNavigator from './SettingsStackNavigator';
import type { MainTabParamList } from '../types/navigation';
import { getTabBarStyle, TAB_BAR_ACTIVE_COLOR, TAB_BAR_INACTIVE_COLOR } from './tabBarConfig';

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
  const insets = useSafeAreaInsets();
  const tabBarStyle = getTabBarStyle(insets);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof MainTabParamList];
          const iconName = focused ? icons.focused : icons.default;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: TAB_BAR_ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_BAR_INACTIVE_COLOR,
        tabBarStyle,
        tabBarHideOnKeyboard: false,
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
        // Keep tab bar tappable above nested stack content
        sceneContainerStyle: { backgroundColor: '#ffffff' },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          headerShown: false,
          // Never hide tabs when drilling into Identify → Edit → Select Marketplaces
          tabBarStyle,
        }}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={({ navigation }) => ({
          title: 'Connections',
          tabBarStyle,
          headerRight: () => (
            <TouchableOpacity
              accessibilityLabel="Connect marketplace"
              onPress={() =>
                navigation.navigate('Settings', {
                  screen: 'ConnectMarketplace',
                  params: { focus: 'ebay' },
                })
              }
              style={{ marginRight: 14, padding: 4 }}
            >
              <Ionicons name="storefront-outline" size={22} color="#3b82f6" />
            </TouchableOpacity>
          ),
        })}
      />
      <Tab.Screen
        name="Listings"
        component={ListingsScreen}
        options={{ title: 'Published Products', tabBarStyle }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: 'Inventory', tabBarStyle }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{ title: 'Settings', headerShown: false, tabBarStyle }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Always show Settings root — avoids landing on a nested screen (e.g. old UploadProduct/Home)
            navigation.navigate('Settings', { screen: 'SettingsMain' });
          },
        })}
      />
    </Tab.Navigator>
  );
}
