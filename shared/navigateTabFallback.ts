/**
 * Pure tab-navigation fallback (testable without React Navigation runtime).
 */
export type TabNavCandidate = {
  getState?: () => { type?: string } | undefined;
  getParent?: () => TabNavCandidate | undefined;
  navigate: (name: string, params?: object) => void;
  dispatch?: (action: unknown) => void;
};

export function findTabNavigator(
  navigation: TabNavCandidate | undefined
): TabNavCandidate | undefined {
  let current = navigation;
  while (current) {
    if (current.getState?.()?.type === 'tab') return current;
    current = current.getParent?.();
  }
  return undefined;
}

export function navigateViaTabAncestor(
  navigation: TabNavCandidate | undefined,
  tabName: string,
  params?: object
): boolean {
  const tab = findTabNavigator(navigation);
  if (tab) {
    tab.navigate(tabName, params);
    return true;
  }
  const parent = navigation?.getParent?.();
  if (parent) {
    parent.navigate(tabName, params);
    return true;
  }
  return false;
}
