import { create } from 'zustand';
import type { DeviceEnrollment } from '@/types';
import { loadEnrollment, saveEnrollment, clearEnrollment } from '@/utils/storage';

interface DeviceState extends DeviceEnrollment {
  isEnrolled: boolean;
  // Actions
  enroll: (data: DeviceEnrollment) => Promise<void>;
  resetDevice: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  isEnrolled: false,
  companyId: '',
  locationId: 0,
  locationName: '',
  kioskDeviceId: '',

  loadFromStorage: async () => {
    const saved = await loadEnrollment();
    if (saved) {
      set({ ...saved, isEnrolled: true });
    }
  },

  enroll: async (data: DeviceEnrollment) => {
    await saveEnrollment(data);
    set({ ...data, isEnrolled: true });
  },

  resetDevice: async () => {
    await clearEnrollment();
    set({
      isEnrolled: false,
      companyId: '',
      locationId: 0,
      locationName: '',
      kioskDeviceId: '',
    });
  },
}));
