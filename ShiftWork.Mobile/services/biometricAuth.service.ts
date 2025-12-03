import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';

export interface BiometricCredentials {
  email: string;
  personId: number;
  companyId: string;
  name?: string;
}

class BiometricAuthService {
  /**
   * Check if device supports biometric authentication
   */
  async isAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      return compatible;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Check if biometric records are enrolled on the device
   */
  async isEnrolled(): Promise<boolean> {
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch (error) {
      console.error('Error checking biometric enrollment:', error);
      return false;
    }
  }

  /**
   * Get supported authentication types (fingerprint, facial recognition, iris)
   */
  async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types;
    } catch (error) {
      console.error('Error getting supported types:', error);
      return [];
    }
  }

  /**
   * Get friendly name for authentication type
   */
  getAuthTypeName(types: LocalAuthentication.AuthenticationType[]): string {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Fingerprint';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris';
    }
    return 'Biometric';
  }

  /**
   * Authenticate user with biometrics
   */
  async authenticate(promptMessage?: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to continue',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }

  /**
   * Check if biometric login is enabled for this user
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled state:', error);
      return false;
    }
  }

  /**
   * Enable biometric login and save credentials
   */
  async enableBiometric(credentials: BiometricCredentials): Promise<boolean> {
    try {
      // First authenticate to confirm user intent
      const authenticated = await this.authenticate('Authenticate to enable biometric login');
      
      if (!authenticated) {
        return false;
      }

      // Save credentials securely
      await SecureStore.setItemAsync(
        BIOMETRIC_CREDENTIALS_KEY,
        JSON.stringify(credentials)
      );
      
      // Enable biometric flag
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      
      return true;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return false;
    }
  }

  /**
   * Disable biometric login and clear saved credentials
   */
  async disableBiometric(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    } catch (error) {
      console.error('Error disabling biometric:', error);
    }
  }

  /**
   * Get saved biometric credentials
   */
  async getCredentials(): Promise<BiometricCredentials | null> {
    try {
      const data = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting biometric credentials:', error);
      return null;
    }
  }

  /**
   * Perform biometric login - authenticate and return credentials
   */
  async biometricLogin(): Promise<BiometricCredentials | null> {
    try {
      // Check if biometric is enabled
      const enabled = await this.isBiometricEnabled();
      if (!enabled) {
        return null;
      }

      // Authenticate user
      const authenticated = await this.authenticate('Sign in with biometric');
      if (!authenticated) {
        return null;
      }

      // Return saved credentials
      return await this.getCredentials();
    } catch (error) {
      console.error('Biometric login error:', error);
      return null;
    }
  }

  /**
   * Check if biometric login should be offered (available, enrolled, and enabled)
   */
  async shouldOfferBiometric(): Promise<boolean> {
    try {
      const available = await this.isAvailable();
      const enrolled = await this.isEnrolled();
      const enabled = await this.isBiometricEnabled();
      
      return available && enrolled && enabled;
    } catch (error) {
      console.error('Error checking if should offer biometric:', error);
      return false;
    }
  }
}

export const biometricAuthService = new BiometricAuthService();
