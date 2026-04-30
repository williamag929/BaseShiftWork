import { create } from 'zustand';
// Firebase sign-out is DISABLED — kept for reference only.
// import { signOut as firebaseSignOut } from 'firebase/auth';
// import { auth } from '@/config/firebase';
import { clearAllStorage } from '@/utils/storage.utils';
import { notificationService } from '@/services/notification.service';

interface AuthState {
  name: string | null;
  photoUrl: string | null;
  companyId: string;
  personId: number | null;
  personEmail: string | null;
  deviceToken: string | null;
  setCompanyId: (companyId: string) => void;
  setPersonId: (personId: number | null) => void;
  setDeviceToken: (token: string | null) => void;
  setPersonProfile: (p: { email?: string | null; name?: string | null; photoUrl?: string | null }) => void;
  signOut: () => Promise<void>;
}

const getDefaultCompanyId = () =>
  (process.env.EXPO_PUBLIC_DEFAULT_COMPANY_ID as string) || 'your-company-id';

export const useAuthStore = create<AuthState>((set, get) => ({
  companyId: getDefaultCompanyId(),
  personId: null,
  personEmail: null,
  name: null,
  photoUrl: null,
  deviceToken: null,
  setCompanyId: (companyId) => set({ companyId }),
  setPersonId: (personId) => set({ personId }),
  setDeviceToken: (token) => set({ deviceToken: token }),
  setPersonProfile: ({ email, name, photoUrl }) =>
    set((s) => ({
      personEmail: email ?? s.personEmail,
      name: name ?? s.name,
      photoUrl: photoUrl ?? s.photoUrl,
    })),
  signOut: async () => {
    const { companyId, personId, deviceToken } = get();
    if (deviceToken && companyId && personId) {
      try { await notificationService.removeDeviceToken(companyId, personId, deviceToken); } catch {}
    }
    await clearAllStorage();
    set({
      personId: null,
      personEmail: null,
      name: null,
      photoUrl: null,
      deviceToken: null,
      companyId: getDefaultCompanyId(),
    });
  },
}));
