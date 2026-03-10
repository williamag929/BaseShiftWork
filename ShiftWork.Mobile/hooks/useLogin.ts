import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
// Firebase auth is DISABLED — kept here for reference only.
// import { signInWithEmailAndPassword } from 'firebase/auth';
// import { auth } from '@/config/firebase';
// import { getFirebaseAuthError } from '@/utils/firebase-error.utils';
import { authService, biometricAuthService } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { saveUserData, saveCompanyId, saveToken } from '@/utils/storage.utils';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/utils/logger';
import { loginSchema, LoginFormData } from '@/utils/schemas/auth';

export interface UseLoginReturn {
  form: ReturnType<typeof useForm<LoginFormData>>;
  loading: boolean;
  showBiometric: boolean;
  biometricType: string;
  handleLogin: (data: LoginFormData) => Promise<void>;
  handleBiometricLogin: () => Promise<void>;
}

export function useLogin(): UseLoginReturn {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const setCompanyId = useAuthStore((s) => s.setCompanyId);
  const setPersonId = useAuthStore((s) => s.setPersonId);
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);
  const toast = useToast();

  const form = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const shouldOffer = await biometricAuthService.shouldOfferBiometric();
        if (shouldOffer) {
          const types = await biometricAuthService.getSupportedTypes();
          setBiometricType(biometricAuthService.getAuthTypeName(types));
          setShowBiometric(true);
          timer = setTimeout(() => handleBiometricLogin(), 500);
        }
      } catch (error) {
        logger.error('[Login] Error checking biometric:', error);
      }
    })();
    return () => clearTimeout(timer);
  }, []);

  const handleBiometricLogin = async () => {
    try {
      const credentials = await biometricAuthService.biometricLogin();
      if (credentials) {
        setPersonId(credentials.personId);
        setCompanyId(credentials.companyId);
        setPersonProfile({ email: credentials.email, name: credentials.name });
        await saveUserData({ personId: credentials.personId, email: credentials.email, name: credentials.name });
        await saveCompanyId(credentials.companyId);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/dashboard' as any);
      }
    } catch (error) {
      logger.error('[Login] Biometric login error:', error);
      toast.error('Biometric authentication failed');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);
    try {
      // Direct API login — Firebase auth is disabled.
      const result = await authService.login({ email: data.email, password: data.password });
      await saveToken(result.token);
      setPersonId(Number(result.personId));
      setCompanyId(result.companyId);
      setPersonProfile({ email: result.email, name: result.name, photoUrl: result.photoUrl });
      await saveUserData({ personId: result.personId, email: result.email, name: result.name });
      await saveCompanyId(result.companyId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/dashboard' as any);
    } catch (error: any) {
      const message = error?.message || 'Invalid email or password.';
      toast.error(message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return { form, loading, showBiometric, biometricType, handleLogin, handleBiometricLogin };
}
