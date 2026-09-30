jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import * as Location from 'expo-location';
import { clearGeo, getLastKnownGeo, refreshGeo, startGeoRefresh } from '../geo.service';

const mockPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPosition = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearGeo();
});

describe('geo.service', () => {
  it('has no fix until one is fetched', () => {
    expect(getLastKnownGeo()).toBeNull();
  });

  it('stores the fix as "lat,lng"', async () => {
    mockPermission.mockResolvedValue({ status: 'granted' });
    mockPosition.mockResolvedValue({ coords: { latitude: 40.75, longitude: -73.98 } });

    await refreshGeo();

    expect(getLastKnownGeo()).toBe('40.75,-73.98');
  });

  it('does nothing when location permission is denied', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });

    await refreshGeo();

    expect(mockPosition).not.toHaveBeenCalled();
    expect(getLastKnownGeo()).toBeNull();
  });

  it('keeps the previous fix when a later lookup fails', async () => {
    mockPermission.mockResolvedValue({ status: 'granted' });
    mockPosition.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2 } });
    await refreshGeo();

    mockPosition.mockRejectedValueOnce(new Error('no signal'));
    await refreshGeo();

    expect(getLastKnownGeo()).toBe('1,2');
  });

  it('startGeoRefresh fetches now and every 5 minutes until stopped', async () => {
    jest.useFakeTimers();
    mockPermission.mockResolvedValue({ status: 'granted' });
    mockPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });

    const stop = startGeoRefresh();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockPosition).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5 * 60_000);
    expect(mockPosition).toHaveBeenCalledTimes(2);

    stop();
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(mockPosition).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
