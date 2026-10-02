jest.mock('firebase/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/config/firebase', () => ({ auth: {} }));
jest.mock('@/utils/storage.utils', () => ({
  clearAllStorage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/notification.service', () => ({ notificationService: { removeDeviceToken: jest.fn() } }));
jest.mock('@/services/company-user.service', () => ({
  companyUserService: { getMyClaims: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { companyUserService } from '@/services/company-user.service';
import { useClaimsSync } from '../usePermission';

const mockGetClaims = companyUserService.getMyClaims as jest.Mock;

const claims = (permissions: string[]) => ({
  companyId: 'co-1', userId: 'u', roles: [], permissions, permissionsVersion: 1,
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ companyId: 'co-1', personId: null, permissions: [] });
});

describe('useClaimsSync', () => {
  it('does not fetch when personId is null', async () => {
    const { wrapper } = setup();
    renderHook(() => useClaimsSync(), { wrapper });
    await act(async () => {});
    expect(mockGetClaims).not.toHaveBeenCalled();
  });

  it('writes permissions to the store on success', async () => {
    mockGetClaims.mockResolvedValue(claims(['lineup.view']));
    useAuthStore.setState({ personId: 1 });
    const { wrapper } = setup();
    renderHook(() => useClaimsSync(), { wrapper });
    await waitFor(() => expect(useAuthStore.getState().permissions).toEqual(['lineup.view']));
    expect(mockGetClaims).toHaveBeenCalledWith('co-1');
  });

  it('leaves permissions unchanged on error', async () => {
    mockGetClaims.mockRejectedValue(new Error('boom'));
    useAuthStore.setState({ personId: 1, permissions: ['keep.me'] });
    const { wrapper } = setup();
    renderHook(() => useClaimsSync(), { wrapper });
    await waitFor(() => expect(mockGetClaims).toHaveBeenCalled());
    await act(async () => {});
    expect(useAuthStore.getState().permissions).toEqual(['keep.me']);
  });

  it('does not reuse another person\'s cached claims', async () => {
    mockGetClaims.mockResolvedValueOnce(claims(['a.perm'])).mockResolvedValueOnce(claims(['b.perm']));
    useAuthStore.setState({ personId: 1 });
    const { wrapper } = setup();
    renderHook(() => useClaimsSync(), { wrapper });
    await waitFor(() => expect(useAuthStore.getState().permissions).toEqual(['a.perm']));
    act(() => { useAuthStore.setState({ personId: 2 }); });
    await waitFor(() => expect(useAuthStore.getState().permissions).toEqual(['b.perm']));
    expect(mockGetClaims).toHaveBeenCalledTimes(2);
  });
});
