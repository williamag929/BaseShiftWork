jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3, High: 4 },
}));

import * as Location from 'expo-location';
import { getQuickLocation } from '../location.utils';

const loc = Location as unknown as Record<string, jest.Mock>;
const fix = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } });

beforeEach(() => {
  jest.clearAllMocks();
  loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
});

it('uses a fresh cached fix without waiting for GPS', async () => {
  loc.getLastKnownPositionAsync.mockResolvedValue(fix(1.5, 2.5));
  await expect(getQuickLocation()).resolves.toBe('1.5,2.5');
  expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(loc.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 120000, requiredAccuracy: 200 });
});

it('takes a new fix when there is no cached one', async () => {
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.getCurrentPositionAsync.mockResolvedValue(fix(3, 4));
  await expect(getQuickLocation()).resolves.toBe('3,4');
});

it('quick location times out and returns null instead of hanging', async () => {
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));
  await expect(getQuickLocation(120000, 20)).resolves.toBeNull();
});

it('returns null when permission is denied', async () => {
  loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await expect(getQuickLocation()).resolves.toBeNull();
  expect(loc.getLastKnownPositionAsync).not.toHaveBeenCalled();
});
