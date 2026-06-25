import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();

export type NavigationLike = {
  getState?: () => { type?: string } | undefined;
  getParent?: () => NavigationLike | undefined;
  navigate: (name: string, params?: object) => void;
  dispatch?: (action: ReturnType<typeof CommonActions.navigate>) => void;
};

/**
 * Switch to a bottom-tab screen from anywhere in the app.
 * Uses the root navigation ref when available (most reliable).
 */
export function navigateToTab(
  navigation: NavigationLike | undefined,
  tabName: string,
  params?: object
): void {
  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate('Main', {
      screen: tabName,
      params,
    } as never);
    return;
  }

  if (navigation?.dispatch) {
    navigation.dispatch(
      CommonActions.navigate({
        name: tabName,
        params,
      })
    );
    return;
  }

  let current: NavigationLike | undefined = navigation;
  while (current) {
    const state = current.getState?.();
    if (state?.type === 'tab') {
      current.navigate(tabName, params);
      return;
    }
    current = current.getParent?.();
  }

  navigation?.getParent?.()?.navigate(tabName, params);
}

/** Open Connect Marketplace on the Settings tab. */
export function navigateToConnectMarketplace(
  navigation?: NavigationLike,
  focus = 'ebay'
): void {
  navigateToTab(navigation, 'Settings', {
    screen: 'ConnectMarketplace',
    params: { focus },
  });
}
