import { create } from 'zustand';
// Firebase sign-out is DISABLED — kept for reference only.
// import { signOut as firebaseSignOut } from 'firebase/auth';
// import { auth } from '@/config/firebase';
import { clearAllStorage } from '@/utils/storage.utils';

interface AuthState {
  name: string | null;
  photoUrl: string | null;
  companyId: string;
  personId: number | null;
  personEmail: string | null;
  setCompanyId: (companyId: string) => void;
  setPersonId: (personId: number | null) => void;
  setPersonProfile: (p: { email?: string | null; name?: string | null; photoUrl?: string | null }) => void;
  signOut: () => Promise<void>;
}

const getDefaultCompanyId = () =>
  (process.env.EXPO_PUBLIC_DEFAULT_COMPANY_ID as string) || 'your-company-id';

export const useAuthStore = create<AuthState>((set) => ({
  companyId: getDefaultCompanyId(),
  personId: null,
  personEmail: null,
  name: null,
  photoUrl: null,
  setCompanyId: (companyId) => set({ companyId }),
  setPersonId: (personId) => set({ personId }),
  setPersonProfile: ({ email, name, photoUrl }) =>
    set((s) => ({
      personEmail: email ?? s.personEmail,
      name: name ?? s.name,
      photoUrl: photoUrl ?? s.photoUrl,
    })),
  signOut: async () => {
    // Firebase sign-out is disabled. Just clear token + profile from storage.
    await clearAllStorage();
    set({
      personId: null,
      personEmail: null,
      name: null,
      photoUrl: null,
      companyId: getDefaultCompanyId(),
    });
  },
}));
