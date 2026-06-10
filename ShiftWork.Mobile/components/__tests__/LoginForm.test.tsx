jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Link: 'Link',
}));
jest.mock('@/config/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('@/services', () => ({
  authService: {
    loginWithEmail: jest.fn(),
    loginWithBiometrics: jest.fn(),
  },
  biometricAuthService: {
    shouldOfferBiometric: jest.fn().mockResolvedValue(false),
    authenticate: jest.fn(),
  },
}));
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/store/authStore', () => {
  const s = {
    setCompanyId: jest.fn(),
    setPersonId: jest.fn(),
    setPersonProfile: jest.fn(),
    signOut: jest.fn(),
  };
  return {
    useAuthStore: jest.fn((selector?: (st: typeof s) => unknown) =>
      typeof selector === 'function' ? selector(s) : s,
    ),
  };
});
jest.mock('@/utils/storage.utils', () => ({ saveUserData: jest.fn(), saveCompanyId: jest.fn(), clearAllStorage: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('@/utils/firebase-error.utils', () => ({ getFirebaseAuthError: jest.fn((e) => e?.message ?? 'Error') }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));

import { renderHook } from '@testing-library/react-native';
import { useLogin } from '@/hooks/useLogin';

describe('useLogin', () => {
  it('returns the expected interface shape', () => {
    const { result } = renderHook(() => useLogin());
    expect(result.current.form).toBeDefined();
    expect(typeof result.current.handleLogin).toBe('function');
    expect(typeof result.current.loading).toBe('boolean');
    expect(typeof result.current.showBiometric).toBe('boolean');
  });

  it('form starts with no errors', () => {
    const { result } = renderHook(() => useLogin());
    expect(result.current.form.formState.errors).toEqual({});
  });

  it('form has the expected RHF methods', () => {
    const { result } = renderHook(() => useLogin());
    // Verify the form exposes the required RHF API
    expect(result.current.form.control).toBeDefined();
    expect(typeof result.current.form.register).toBe('function');
    expect(typeof result.current.form.trigger).toBe('function');
    expect(typeof result.current.form.getValues).toBe('function');
  });
});

