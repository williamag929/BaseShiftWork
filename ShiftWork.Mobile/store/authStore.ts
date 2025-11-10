import { create } from 'zustand';

interface AuthState {
  name: string | null | undefined;
  companyId: string;
  personId: number | null;
  personEmail: string | null;
  personFirstName: string | null;
  personLastName: string | null;
  setCompanyId: (companyId: string) => void;
  setPersonId: (personId: number | null) => void;
  setPersonProfile: (p: { email?: string | null; name?: string | null; firstName?: string | null; lastName?: string | null }) => void;
}

const getDefaultCompanyId = () =>
  (process.env.EXPO_PUBLIC_DEFAULT_COMPANY_ID as string) || 'your-company-id';

export const useAuthStore = create<AuthState>((set) => ({
  companyId: getDefaultCompanyId(),
  personId: null,
  personEmail: null,
  name: null,
  personFirstName: null,
  personLastName: null,
  setCompanyId: (companyId) => set({ companyId }),
  setPersonId: (personId) => set({ personId }),
  setPersonProfile: ({ email, name, firstName, lastName }) =>
    set((s) => ({
      personEmail: email ?? s.personEmail,
      name: name ?? s.name,
      personFirstName: firstName ?? s.personFirstName,
      personLastName: lastName ?? s.personLastName,
    })),
}));
