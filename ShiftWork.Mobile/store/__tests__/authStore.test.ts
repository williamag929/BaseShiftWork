// Must mock Firebase and storage BEFORE importing authStore
jest.mock('firebase/auth', () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/config/firebase', () => ({ auth: {} }));
jest.mock('@/utils/storage.utils', () => ({
  clearAllStorage: jest.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from '../../store/authStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset mutable fields to a known state before each test
    useAuthStore.setState({
      personId: null,
      name: null,
      personEmail: null,
      photoUrl: null,
    });
  });

  it('setPersonId updates personId', () => {
    useAuthStore.getState().setPersonId(42);
    expect(useAuthStore.getState().personId).toBe(42);
  });

  it('setCompanyId updates companyId', () => {
    useAuthStore.getState().setCompanyId('company-abc');
    expect(useAuthStore.getState().companyId).toBe('company-abc');
  });

  it('setPersonProfile updates name and personEmail', () => {
    useAuthStore.getState().setPersonProfile({ name: 'Alice', email: 'alice@example.com' });
    expect(useAuthStore.getState().name).toBe('Alice');
    expect(useAuthStore.getState().personEmail).toBe('alice@example.com');
  });

  it('setPersonProfile does not overwrite existing fields when value is undefined', () => {
    useAuthStore.setState({ name: 'Bob', personEmail: 'bob@example.com' });
    useAuthStore.getState().setPersonProfile({ name: undefined });
    // Undefined should not overwrite
    expect(useAuthStore.getState().name).toBe('Bob');
  });

  it('signOut clears personId, name, and personEmail', async () => {
    useAuthStore.setState({ personId: 99, name: 'Eve', personEmail: 'eve@example.com' });
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().personId).toBeNull();
    expect(useAuthStore.getState().name).toBeNull();
    expect(useAuthStore.getState().personEmail).toBeNull();
  });
});
