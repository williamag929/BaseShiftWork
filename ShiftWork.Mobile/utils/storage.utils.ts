import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const COMPANY_KEY = 'company_id';
const ACTIVE_CLOCKIN_AT_KEY = 'active_clockin_at';

/**
 * Save auth token securely
 */
export const saveToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

/**
 * Get saved auth token
 */
export const getToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

/**
 * Remove auth token
 */
export const removeToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

/**
 * Save user data
 */
export const saveUserData = async (userData: any): Promise<void> => {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
};

/**
 * Get saved user data
 */
export const getUserData = async (): Promise<any | null> => {
  const data = await SecureStore.getItemAsync(USER_KEY);
  return data ? JSON.parse(data) : null;
};

/**
 * Remove user data
 */
export const removeUserData = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(USER_KEY);
};

/**
 * Save company ID
 */
export const saveCompanyId = async (companyId: string): Promise<void> => {
  await SecureStore.setItemAsync(COMPANY_KEY, companyId);
};

/**
 * Get saved company ID
 */
export const getCompanyId = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(COMPANY_KEY);
};

/**
 * Remove company ID
 */
export const removeCompanyId = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(COMPANY_KEY);
};

/**
 * Clear all secure storage
 */
export const clearAllStorage = async (): Promise<void> => {
  await removeToken();
  await removeUserData();
  await removeCompanyId();
};

/**
 * Persist timestamp when user clocks in so we can show elapsed time across restarts/offline
 */
export const saveActiveClockInAt = async (isoDate: string): Promise<void> => {
  await SecureStore.setItemAsync(ACTIVE_CLOCKIN_AT_KEY, isoDate);
};

export const getActiveClockInAt = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(ACTIVE_CLOCKIN_AT_KEY);
};

export const clearActiveClockInAt = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ACTIVE_CLOCKIN_AT_KEY);
};
