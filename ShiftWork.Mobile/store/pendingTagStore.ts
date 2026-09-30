import { create } from 'zustand';

/** A tap older than this is stale: the worker has moved on and must not be punched unexpectedly. */
export const PENDING_TAG_MAX_AGE_MS = 10 * 60_000;

/** A tag tapped while signed out; resumed after sign-in by the tabs layout. Memory only. */
interface PendingTagState {
  tagKey: string | null;
  savedAt: number;
  setTagKey: (tagKey: string | null) => void;
  take: () => string | null;
}

export const usePendingTagStore = create<PendingTagState>((set, get) => ({
  tagKey: null,
  savedAt: 0,
  setTagKey: (tagKey) => set({ tagKey, savedAt: tagKey ? Date.now() : 0 }),
  take: () => {
    const { tagKey, savedAt } = get();
    set({ tagKey: null, savedAt: 0 });
    return tagKey && Date.now() - savedAt <= PENDING_TAG_MAX_AGE_MS ? tagKey : null;
  },
}));
