import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mobileRoot = join(__dirname, '..', 'mobile', 'src');

describe('Settings navigation smoke', () => {
  it('SettingsScreen imports TextInput from react-native', () => {
    const src = readFileSync(join(mobileRoot, 'screens/SettingsScreen.tsx'), 'utf8');
    expect(src).toMatch(/TextInput/);
    expect(src).toMatch(/from 'react-native'/);
  });

  it('Settings stack registers SettingsMain and ConnectMarketplace', () => {
    const src = readFileSync(join(mobileRoot, 'navigation/SettingsStackNavigator.tsx'), 'utf8');
    expect(src).toContain('name="SettingsMain"');
    expect(src).toContain('name="ConnectMarketplace"');
  });

  it('MainNavigator includes Settings tab with visible tab bar', () => {
    const src = readFileSync(join(mobileRoot, 'navigation/MainNavigator.tsx'), 'utf8');
    expect(src).toContain('name="Settings"');
    expect(src).toContain('SettingsStackNavigator');
    expect(src).toContain('getTabBarStyle');
  });

  it('App wires rootNavigationRef on NavigationContainer', () => {
    const src = readFileSync(join(mobileRoot, '../App.tsx'), 'utf8');
    expect(src).toContain('ref={rootNavigationRef}');
  });

  it('navigateToTab accepts unknown navigation objects', () => {
    const src = readFileSync(join(mobileRoot, 'navigation/navigateToTab.ts'), 'utf8');
    expect(src).toContain('navigation: unknown');
    expect(src).toContain('navigateToConnectMarketplace');
  });
});
