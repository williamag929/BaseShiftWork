const mockScreens: Record<string, any> = {};
jest.mock('expo-router', () => {
  const Tabs: any = ({ children }: any) => children;
  Tabs.Screen = ({ name, options }: any) => {
    mockScreens[name] = options;
    return null;
  };
  return { Tabs };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/useServerLocale', () => ({ useServerLocale: jest.fn() }));
jest.mock('@/hooks/usePermission', () => ({
  ...jest.requireActual('@/hooks/usePermission'),
  useClaimsSync: jest.fn(),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import TabsLayout from '../../app/(tabs)/_layout';
import { useAuthStore } from '@/store/authStore';

const lineupOptions = (permissions: string[]) => {
  useAuthStore.setState({ permissions });
  render(<TabsLayout />);
  return mockScreens.lineup;
};

describe('lineup tab gating', () => {
  it('hides the tab (href: null) without lineup.view', () => {
    expect(lineupOptions([])).toMatchObject({ href: null });
  });

  it('shows the tab with lineup.view', () => {
    const opts = lineupOptions(['lineup.view']);
    expect(opts).toBeDefined();
    expect(opts.href).toBeUndefined();
    expect(opts.title).toBe('tabs.lineup');
  });
});
