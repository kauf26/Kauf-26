import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { navigateViaTabAncestor, type TabNavCandidate } from '../../../shared/navigateTabFallback';

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();

function asNavigationLike(navigation: unknown): TabNavCandidate | undefined {
  if (!navigation || typeof navigation !== 'object') return undefined;
  return navigation as TabNavCandidate;
}

/**
 * Switch to a bottom-tab screen from anywhere in the app.
 * Uses the root navigation ref when available (most reliable).
 */
export function navigateToTab(
  navigation: unknown,
  tabName: string,
  params?: object
): void {
  const nav = asNavigationLike(navigation);

  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate('Main', {
      screen: tabName,
      params,
    } as never);
    return;
  }

  if (nav?.dispatch) {
    nav.dispatch(
      CommonActions.navigate({
        name: tabName,
        params,
      })
    );
    return;
  }

  if (navigateViaTabAncestor(nav, tabName, params)) {
    return;
  }
}

/** Open Connect Marketplace on the Settings tab. */
export function navigateToConnectMarketplace(navigation?: unknown, focus = 'ebay'): void {
  navigateToTab(navigation, 'Settings', {
    screen: 'ConnectMarketplace',
    params: { focus },
  });
}
