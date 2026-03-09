jest.mock('@/config/firebase', () => ({ auth: {}, app: {} }));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(), signOut: jest.fn() }));
jest.mock('@/hooks/queries', () => ({
  useShiftEvents: jest.fn(() => ({ data: [], isLoading: false, isError: false, error: null })),
  useClockMutation: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useLocationName: jest.fn(() => ({ data: null })),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: null, isLoading: false })),
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector) =>
    selector({
      companyId: 'co1',
      personId: 1,
      name: 'Test User',
      personEmail: 'test@example.com',
      photoUrl: null,
    }),
  ),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/services/people.service', () => ({ personService: { getPersonById: jest.fn() } }));
jest.mock('@/utils', () => ({ getCurrentLocation: jest.fn() }));

import { renderHook } from '@testing-library/react-native';
import { useClockAction } from '../useClockAction';

describe('useClockAction', () => {
  it('returns the expected interface shape', () => {
    const { result } = renderHook(() => useClockAction());
    const data = result.current;
    expect(typeof data.handleClock).toBe('function');
    expect(typeof data.loading).toBe('boolean');
    expect(typeof data.initializing).toBe('boolean');
    expect(Object.prototype.hasOwnProperty.call(data, 'isClockedIn')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(data, 'elapsedSeconds')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(data, 'personName')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(data, 'locationName')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(data, 'events')).toBe(true);
  });

  it('fmtHMS correctly formats 3661 seconds as 01:01:01', () => {
    const { result } = renderHook(() => useClockAction());
    expect(result.current.fmtHMS(3661)).toBe('01:01:01');
  });

  it('fmtHMS correctly formats 0 seconds as 00:00:00', () => {
    const { result } = renderHook(() => useClockAction());
    expect(result.current.fmtHMS(0)).toBe('00:00:00');
  });
});
