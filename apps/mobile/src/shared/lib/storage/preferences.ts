import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The two preferences this app persists, behind a deliberately tiny surface.
 *
 * A wrapper rather than calling `AsyncStorage` at each site: reads have to be
 * allowed to fail. Storage on a phone can be unavailable — a full disk, a
 * corrupted store — and a preference that cannot be read is not an error worth
 * showing anyone, it just means falling back to the device default. Swallowing
 * that in one place is what keeps the callers readable.
 */
export async function readPreference(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writePreference(key: string, value: string) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // A preference that fails to save is a preference that reverts next launch,
    // which is a great deal better than a crash on a toggle.
  }
}
