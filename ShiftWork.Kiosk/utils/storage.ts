import * as SecureStore from 'expo-secure-store';
import type { DeviceEnrollment } from '@/types';

const ENROLLMENT_KEY = 'kiosk_device_enrollment';

export async function saveEnrollment(enrollment: DeviceEnrollment): Promise<void> {
  await SecureStore.setItemAsync(ENROLLMENT_KEY, JSON.stringify(enrollment));
}

export async function loadEnrollment(): Promise<DeviceEnrollment | null> {
  const raw = await SecureStore.getItemAsync(ENROLLMENT_KEY);
  return raw ? (JSON.parse(raw) as DeviceEnrollment) : null;
}

export async function clearEnrollment(): Promise<void> {
  await SecureStore.deleteItemAsync(ENROLLMENT_KEY);
}
