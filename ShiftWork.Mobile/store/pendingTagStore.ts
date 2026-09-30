import { create } from 'zustand';

/** A tag tapped while signed out; resumed after sign-in by the tabs layout. Memory only. */
interface PendingTagState {
  tagKey: string | null;
  setTagKey: (tagKey: string | null) => void;
  take: () => string | null;
}

export const usePendingTagStore = create<PendingTagState>((set, get) => ({
  tagKey: null,
  setTagKey: (tagKey) => set({ tagKey }),
  take: () => {
    const tagKey = get().tagKey;
    set({ tagKey: null });
    return tagKey;
  },
}));
