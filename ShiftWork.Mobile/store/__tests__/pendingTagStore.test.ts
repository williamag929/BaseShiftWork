import { usePendingTagStore, PENDING_TAG_MAX_AGE_MS } from '../pendingTagStore';

afterEach(() => {
  jest.restoreAllMocks();
  usePendingTagStore.getState().setTagKey(null);
});

it('returns a fresh key once and clears it', () => {
  usePendingTagStore.getState().setTagKey('KEY');
  expect(usePendingTagStore.getState().take()).toBe('KEY');
  expect(usePendingTagStore.getState().take()).toBeNull();
});

it('returns null for a key older than 10 minutes, and still clears it', () => {
  const now = Date.now();
  const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
  usePendingTagStore.getState().setTagKey('KEY');
  spy.mockReturnValue(now + PENDING_TAG_MAX_AGE_MS + 1);
  expect(usePendingTagStore.getState().take()).toBeNull();
  expect(usePendingTagStore.getState().tagKey).toBeNull();
  spy.mockReturnValue(now + 1);
  expect(usePendingTagStore.getState().take()).toBeNull();
});

it('returns null when nothing is pending', () => {
  expect(usePendingTagStore.getState().take()).toBeNull();
});
