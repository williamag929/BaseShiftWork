import * as Location from 'expo-location';

const REFRESH_MS = 5 * 60_000;

let lastKnown: string | null = null;

/** The most recent fix as "lat,lng", or null. A kiosk is fixed on a wall, so a fix a few minutes old is fine. */
export function getLastKnownGeo(): string | null {
  return lastKnown;
}

export function clearGeo(): void {
  lastKnown = null;
}

/** Fetches a fix. Never throws and never blocks a punch; failures keep the previous fix. */
export async function refreshGeo(): Promise<void> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    lastKnown = `${loc.coords.latitude},${loc.coords.longitude}`;
  } catch {
    // Geo is optional.
  }
}

/** Fetch now, then every 5 minutes. Returns a function that stops it. */
export function startGeoRefresh(): () => void {
  void refreshGeo();
  const id = setInterval(() => void refreshGeo(), REFRESH_MS);
  return () => clearInterval(id);
}
