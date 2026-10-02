jest.mock('firebase/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/config/firebase', () => ({ auth: {} }));
jest.mock('@/utils/storage.utils', () => ({
  clearAllStorage: jest.fn().mockResolvedValue(undefined),
}));

import { renderHook } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../usePermission';

describe('usePermission', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['lineup.view'] });
  });

  it('returns true for a held permission', () => {
    const { result } = renderHook(() => usePermission('lineup.view'));
    expect(result.current).toBe(true);
  });

  it('returns false for a missing permission', () => {
    const { result } = renderHook(() => usePermission('lineup.edit'));
    expect(result.current).toBe(false);
  });
});
