import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getFirebaseAuthError } from '@/utils/firebase-error.utils';
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
      const credential = await createUserWithEmailAndPassword(auth, step1.email, step1.password);
      const response = await registrationService.register({
        firebaseUid: credential.user.uid,
        userEmail: step1.email,
        userDisplayName: step1.displayName,
        companyName: step2.companyName,
        companyEmail: step2.companyEmail,
        companyPhone: step2.companyPhone || undefined,
        timeZone: step2.timeZone,
      });
      await AsyncStorage.setItem('onboarding_company_id', response.companyId);
      await AsyncStorage.setItem('onboarding_plan', response.plan ?? 'Free');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(auth)/onboarding' as any);
    } catch (err: any) {
      const msg = err?.code ? getFirebaseAuthError(err.code) : (err?.message ?? 'Registration failed. Please try again.');
      toast.error(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return { step, setStep, loading, step1Form, step2Form, handleRegister };
}
