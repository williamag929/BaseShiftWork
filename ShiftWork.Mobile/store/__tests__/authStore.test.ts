// Must mock Firebase and storage BEFORE importing authStore
jest.mock('firebase/auth', () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/config/firebase', () => ({ auth: {} }));
jest.mock('@/utils/storage.utils', () => ({
  clearAllStorage: jest.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from '../../store/authStore';
import { useLineupDraftStore } from '../../store/lineupDraftStore';

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

  it('setPermissions stores permissions and signOut resets them', async () => {
    useAuthStore.getState().setPermissions(['lineup.view']);
    expect(useAuthStore.getState().permissions).toEqual(['lineup.view']);
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().permissions).toEqual([]);
  });

  it('setCompanyId resets permissions only when the company actually changes', () => {
    useAuthStore.setState({ companyId: 'co-1', permissions: ['lineup.view'] });
    useAuthStore.getState().setCompanyId('co-1');
    expect(useAuthStore.getState().permissions).toEqual(['lineup.view']);
    useAuthStore.getState().setCompanyId('co-2');
    expect(useAuthStore.getState().permissions).toEqual([]);
  });

  it('signOut clears the lineup draft', async () => {
    useLineupDraftStore.getState().setScope('co-1', '2026-10-02');
    useLineupDraftStore.getState().assign(41, 7, { start: '07:00', end: '15:00', areaId: null });
    await useAuthStore.getState().signOut();
    expect(useLineupDraftStore.getState().assignments).toEqual([]);
    expect(useLineupDraftStore.getState().companyId).toBeNull();
  });
});
