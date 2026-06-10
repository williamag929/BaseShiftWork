import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { timeOffRequestService } from '@/services/time-off-request.service';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/utils/logger';
import { timeOffSchema, TimeOffFormData } from '@/utils/schemas/timeoff';

export interface UseTimeOffFormReturn {
  form: ReturnType<typeof useForm<TimeOffFormData>>;
  ptoBalance: number | null;
  estimatedHours: number;
  businessDays: number;
  showStartPicker: boolean;
  setShowStartPicker: (v: boolean) => void;
  showEndPicker: boolean;
  setShowEndPicker: (v: boolean) => void;
  submitting: boolean;
  onSubmit: (data: TimeOffFormData) => Promise<void>;
  onStartDateChange: (event: any, date?: Date) => void;
  onEndDateChange: (event: any, date?: Date) => void;
  formatDate: (date: Date) => string;
}

export function useTimeOffForm(): UseTimeOffFormReturn {
  const router = useRouter();
  const { companyId, personId } = useAuthStore();
  const toast = useToast();

  const [ptoBalance, setPtoBalance] = useState<number | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TimeOffFormData>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: { type: 'Vacation', startDate: new Date(), endDate: new Date(), reason: '' },
  });

  const watchedStart = form.watch('startDate');
  const watchedEnd = form.watch('endDate');
  const estimatedHours = timeOffRequestService.calculateHoursRequested(watchedStart, watchedEnd);
  const businessDays = timeOffRequestService.calculateBusinessDays(watchedStart, watchedEnd);

  useEffect(() => {
    if (companyId && personId) {
      timeOffRequestService.getPtoBalance(companyId, personId)
        .then((b) => setPtoBalance(b.balance))
        .catch((err) => logger.error('[TimeOff] Error loading PTO balance:', err));
    }
  }, [companyId, personId]);

  const onSubmit = async (data: TimeOffFormData) => {
    if (!companyId || !personId) { toast.error('User not authenticated'); return; }
    setSubmitting(true);
    try {
      await timeOffRequestService.createTimeOffRequest(companyId, {
        personId,
        type: data.type,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        isPartialDay: false,
        reason: data.reason?.trim() || undefined,
      });
      toast.success('Time off request submitted for approval.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error: any) {
      logger.error('[TimeOff] Error submitting:', error);
      toast.error(error.message || 'Failed to submit time off request. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      form.setValue('startDate', selectedDate);
      const end = form.getValues('endDate');
      if (selectedDate > end) form.setValue('endDate', selectedDate);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) form.setValue('endDate', selectedDate);
  };

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return { form, ptoBalance, estimatedHours, businessDays, showStartPicker, setShowStartPicker, showEndPicker, setShowEndPicker, submitting, onSubmit, onStartDateChange, onEndDateChange, formatDate };
}
