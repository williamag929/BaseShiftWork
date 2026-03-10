import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { peopleService, biometricAuthService } from '@/services';
import { uploadPhoto } from '@/services/upload.service';
import type { PersonDto } from '@/types/api';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/utils/logger';
import { profileSchema, ProfileFormData } from '@/utils/schemas/profile';

export interface UseProfileReturn {
  person: PersonDto | null;
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  changingPin: boolean;
  setChangingPin: (v: boolean) => void;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricType: string;
  showPhotoCapture: boolean;
  setShowPhotoCapture: (v: boolean) => void;
  uploadingPhoto: boolean;
  photoUrl: string;
  form: ReturnType<typeof useForm<ProfileFormData>>;
  onRefresh: () => Promise<void>;
  handleToggleBiometric: (v: boolean) => Promise<void>;
  handlePhotoCapture: (uri: string) => Promise<void>;
  saveProfile: (data: ProfileFormData) => Promise<void>;
  cancelEdit: () => void;
  handleChangePin: (currentPin: string, newPin: string) => Promise<void>;
  handleSignOut: () => void;
}

export function useProfile(): UseProfileReturn {
  const { companyId, personId, signOut, setPersonProfile } = useAuthStore();
  const toast = useToast();

  const [person, setPerson] = useState<PersonDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phoneNumber: '' },
  });

  const loadProfile = useCallback(async () => {
    if (!companyId || !personId) return;
    try {
      setLoading(true);
      const data = await peopleService.getPersonById(companyId, personId);
      setPerson(data);
      setPhotoUrl(data.photoUrl || '');
      form.reset({ name: data.name || '', email: data.email || '', phoneNumber: data.phoneNumber || '' });
    } catch (error: any) {
      logger.error('[Profile] Error loading profile:', error);
      toast.error(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [companyId, personId]);

  const checkBiometric = useCallback(async () => {
    try {
      const available = await biometricAuthService.isAvailable();
      const enrolled = await biometricAuthService.isEnrolled();
      const enabled = await biometricAuthService.isBiometricEnabled();
      const types = await biometricAuthService.getSupportedTypes();
      setBiometricAvailable(available && enrolled);
      setBiometricEnabled(enabled);
      setBiometricType(biometricAuthService.getAuthTypeName(types));
    } catch (error) {
      logger.error('[Profile] Error checking biometric:', error);
    }
  }, []);

  useEffect(() => { loadProfile(); checkBiometric(); }, [companyId, personId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), checkBiometric()]);
    setRefreshing(false);
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (!companyId || !personId || !person) return;
    try {
      if (value) {
        const success = await biometricAuthService.enableBiometric({ email: person.email || '', personId, companyId, name: person.name });
        if (success) { setBiometricEnabled(true); toast.success(`${biometricType} login enabled`); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
        else { toast.error(`Could not enable ${biometricType} login`); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
      } else {
        await biometricAuthService.disableBiometric();
        setBiometricEnabled(false);
        toast.success(`${biometricType} login disabled`);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      logger.error('[Profile] Error toggling biometric:', error);
      toast.error(error.message || 'Failed to update biometric settings');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handlePhotoCapture = async (uri: string) => {
    if (!companyId || !personId) return;
    try {
      setUploadingPhoto(true);
      const uploadedUrl = await uploadPhoto(uri, 'shiftwork-photos');
      if (uploadedUrl.startsWith('file://') || uploadedUrl.includes('/var/mobile/')) throw new Error('Upload failed: Got local file path instead of S3 URL');
      const updated = await peopleService.partialUpdatePerson(companyId, personId, { photoUrl: uploadedUrl });
      setPerson(updated);
      setPhotoUrl(uploadedUrl);
      setPersonProfile({ photoUrl: uploadedUrl });
      toast.success('Photo updated successfully');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      logger.error('[Profile] Error uploading photo:', error);
      toast.error(error.message || 'Failed to update photo');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProfile = async (data: ProfileFormData) => {
    if (!companyId || !personId) return;
    try {
      setSaving(true);
      const updated = await peopleService.updatePerson(companyId, personId, { name: data.name.trim(), email: data.email.trim(), phoneNumber: data.phoneNumber?.trim() });
      setPerson(updated);
      setEditMode(false);
      setPersonProfile({ name: data.name.trim(), email: data.email.trim() });
      toast.success('Profile updated successfully');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      logger.error('[Profile] Error saving profile:', error);
      toast.error(error.message || 'Failed to update profile');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (person) form.reset({ name: person.name || '', email: person.email || '', phoneNumber: person.phoneNumber || '' });
    setEditMode(false);
  };

  const handleChangePin = async (currentPin: string, newPin: string) => {
    if (!companyId || !personId) return;
    try {
      setSaving(true);
      await peopleService.updatePin(companyId, personId, currentPin, newPin);
      setChangingPin(false);
      toast.success('PIN changed successfully');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      logger.error('[Profile] Error changing PIN:', error);
      toast.error(error.message || 'Failed to change PIN. Please check your current PIN.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return {
    person, loading, refreshing, saving, editMode, setEditMode, changingPin, setChangingPin,
    biometricAvailable, biometricEnabled, biometricType, showPhotoCapture, setShowPhotoCapture,
    uploadingPhoto, photoUrl, form, onRefresh, handleToggleBiometric, handlePhotoCapture,
    saveProfile, cancelEdit, handleChangePin, handleSignOut,
  };
}
