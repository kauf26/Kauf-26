import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { navigateToTab, navigateToConnectMarketplace, type NavigationLike } from '../navigation/navigateToTab';

type Props = {
  /** Highlight storefront icon when user likely needs OAuth */
  emphasizeConnect?: boolean;
};

/**
 * Header shortcuts on publish-flow screens so users can reach Connections / Settings
 * without relying on the bottom tab bar alone.
 */
export default function FlowTabHeaderActions({ emphasizeConnect = false }: Props) {
  const navigation = useNavigation() as NavigationLike;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityLabel="Open Connections tab"
        onPress={() => navigateToTab(navigation, 'Connections')}
        style={styles.btn}
        hitSlop={8}
      >
        <Ionicons name="link-outline" size={22} color="#2563eb" />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Connect marketplace"
        onPress={() => navigateToConnectMarketplace(navigation, 'ebay')}
        style={[styles.btn, emphasizeConnect && styles.btnEmphasis]}
        hitSlop={8}
      >
        <Ionicons
          name="storefront-outline"
          size={22}
          color={emphasizeConnect ? '#ffffff' : '#2563eb'}
        />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Open Settings tab"
        onPress={() => navigateToTab(navigation, 'Settings', { screen: 'SettingsMain' })}
        style={styles.btn}
        hitSlop={8}
      >
        <Ionicons name="settings-outline" size={22} color="#2563eb" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
  },
  btn: {
    padding: 6,
    borderRadius: 8,
  },
  btnEmphasis: {
    backgroundColor: '#2563eb',
  },
});
