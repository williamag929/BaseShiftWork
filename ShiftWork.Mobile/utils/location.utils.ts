import * as Location from 'expo-location';

/**
 * Request location permissions
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
};

/**
 * Get current location coordinates
 */
export const getCurrentLocation = async (): Promise<string | null> => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.warn('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return `${location.coords.latitude},${location.coords.longitude}`;
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

/**
 * Format coordinates for display
 */
export const formatCoordinates = (geoLocation: string): string => {
  const [lat, lon] = geoLocation.split(',');
  return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}`;
};

/**
 * A fast position for punches: a recent cached fix if there is one, else a balanced fix capped at
 * `timeoutMs`. Null (never a throw) when permission is denied or no fix arrives in time. The server
 * then flags the punch GeofenceStatus = Unknown instead of refusing it.
 */
export const getQuickLocation = async (maxAgeMs = 120_000, timeoutMs = 4_000): Promise<string | null> => {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    const granted = current.status === 'granted' || (await requestLocationPermission());
    if (!granted) return null;

    const cached = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs, requiredAccuracy: 200 });
    if (cached) return `${cached.coords.latitude},${cached.coords.longitude}`;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
    try {
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeout,
      ]);
      return fresh ? `${fresh.coords.latitude},${fresh.coords.longitude}` : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
};
