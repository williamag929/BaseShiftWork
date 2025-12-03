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
