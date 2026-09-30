import AsyncStorage from '@react-native-async-storage/async-storage';

/** Reads a JSON value; returns null when missing or unreadable. Never throws. */
export async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Writes a JSON value. Throws on failure so callers (the outbox) can react. */
export async function setJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
