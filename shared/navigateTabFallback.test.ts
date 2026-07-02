import { describe, it, expect, vi } from 'vitest';
import { findTabNavigator, navigateViaTabAncestor } from './navigateTabFallback';

describe('navigateTabFallback', () => {
  it('finds tab navigator in parent chain', () => {
    const tabNavigate = vi.fn();
    const tabNav = {
      getState: () => ({ type: 'tab' }),
      navigate: tabNavigate,
    };
    const stackNav = {
      getState: () => ({ type: 'stack' }),
      getParent: () => tabNav,
      navigate: vi.fn(),
    };

    expect(findTabNavigator(stackNav)).toBe(tabNav);
    expect(navigateViaTabAncestor(stackNav, 'Settings')).toBe(true);
    expect(tabNavigate).toHaveBeenCalledWith('Settings', undefined);
  });

  it('falls back to direct parent when no tab navigator exists', () => {
    const parentNavigate = vi.fn();
    const stackNav = {
      getState: () => ({ type: 'stack' }),
      getParent: () => ({ navigate: parentNavigate }),
      navigate: vi.fn(),
    };

    expect(findTabNavigator(stackNav)).toBeUndefined();
    expect(navigateViaTabAncestor(stackNav, 'Connections')).toBe(true);
    expect(parentNavigate).toHaveBeenCalledWith('Connections', undefined);
  });
});
