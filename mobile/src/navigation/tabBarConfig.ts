import type { EdgeInsets } from 'react-native-safe-area-context';

/** Shared bottom tab bar styling — always visible on every screen. */
export function getTabBarStyle(insets: EdgeInsets) {
  const bottomPad = Math.max(insets.bottom, 8);
  return {
    display: 'flex' as const,
    backgroundColor: '#111827',
    borderTopColor: '#1f2937',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: bottomPad,
    height: 52 + bottomPad,
  };
}

export const TAB_BAR_ACTIVE_COLOR = '#3b82f6';
export const TAB_BAR_INACTIVE_COLOR = '#6b7280';
