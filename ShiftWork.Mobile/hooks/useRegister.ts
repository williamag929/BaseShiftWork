import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Firebase auth is DISABLED. Company registration via Firebase is not available.
// import { createUserWithEmailAndPassword } from 'firebase/auth';
// import { auth } from '@/config/firebase';
// import { getFirebaseAuthError } from '@/utils/firebase-error.utils';
import { registrationService } from '@/services/registration.service';
import { useToast } from '@/hooks/useToast';
import { registerStep1Schema, registerStep2Schema, RegisterStep1Data, RegisterStep2Data } from '@/utils/schemas/auth';

export function useRegister() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const step1Form = useForm<RegisterStep1Data>({ resolver: zodResolver(registerStep1Schema) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const step2Form = useForm<RegisterStep2Data>({ resolver: zodResolver(registerStep2Schema) as any, defaultValues: { timeZone: 'UTC' } });

  const handleRegister = async () => {
    const step1 = step1Form.getValues();
    const step2 = step2Form.getValues();
    setLoading(true);
    try {
      // Firebase auth is DISABLED. Company self-registration requires Firebase to be enabled.
      // Contact your administrator to create a company account.
      toast.error('Company registration is currently unavailable. Please contact your administrator.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (err: any) {
      const msg = err?.message ?? 'Registration failed. Please try again.';
      toast.error(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return { step, setStep, loading, step1Form, step2Form, handleRegister };
}
