import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '@/store/authStore';
import { timeOffRequestService, CreateTimeOffRequest } from '@/services/time-off-request.service';
import { colors } from '@/styles/theme';
import { Button, Card } from '@/components/ui';

export default function TimeOffRequestScreen() {
  const router = useRouter();
  const { companyId, personId } = useAuthStore();

  const [type, setType] = useState<'Vacation' | 'Sick' | 'PTO' | 'Unpaid' | 'Personal'>('Vacation');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ptoBalance, setPtoBalance] = useState<number | null>(null);
  const [estimatedHours, setEstimatedHours] = useState(0);

  const types: Array<'Vacation' | 'Sick' | 'PTO' | 'Unpaid' | 'Personal'> = [
    'Vacation',
    'Sick',
    'PTO',
    'Unpaid',
    'Personal',
  ];

  useEffect(() => {
    if (companyId && personId) {
      timeOffRequestService
        .getPtoBalance(companyId, personId)
        .then(balance => setPtoBalance(balance.balance))
        .catch(err => console.error('Error loading PTO balance:', err));
    }
  }, [companyId, personId]);

  useEffect(() => {
    const hours = timeOffRequestService.calculateHoursRequested(startDate, endDate);
    setEstimatedHours(hours);
  }, [startDate, endDate]);

  const handleSubmit = async () => {
    if (!companyId || !personId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setSubmitting(true);

    const request: CreateTimeOffRequest = {
      personId: personId,
      type,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isPartialDay: false,
      reason: reason.trim() || undefined,
    };

    try {
      await timeOffRequestService.createTimeOffRequest(companyId, request);
      Alert.alert(
        'Success',
        'Your time off request has been submitted for approval.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error submitting time off request:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to submit time off request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
      if (selectedDate > endDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Request Time Off</Text>
      </View>

      {ptoBalance !== null && (
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available PTO Balance</Text>
          <Text style={styles.balanceValue}>{ptoBalance.toFixed(2)} hours</Text>
        </Card>
      )}

      <View style={styles.form}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeSelector}>
            {types.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeButton,
                  type === t && styles.typeButtonActive,
                ]}
                onPress={() => setType(t)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === t && styles.typeButtonTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Start Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartPicker(true)}
          >
            <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={onStartDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>End Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndPicker(true)}
          >
            <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
          </TouchableOpacity>
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={onEndDateChange}
              minimumDate={startDate}
            />
          )}
        </View>

        <Card style={styles.estimateCard}>
          <Text style={styles.estimateLabel}>Estimated Hours</Text>
          <Text style={styles.estimateValue}>{estimatedHours} hours</Text>
          <Text style={styles.estimateNote}>
            Based on {timeOffRequestService.calculateBusinessDays(startDate, endDate)} business days
          </Text>
        </Card>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Reason (Optional)</Text>
          <TextInput
            style={styles.textArea}
            value={reason}
            onChangeText={setReason}
            placeholder="Why are you requesting time off?"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Button
          label={submitting ? 'Submitting...' : 'Submit Request'}
          onPress={handleSubmit}
          loading={submitting}
          variant="primary"
          style={styles.submitButton}
        />

        <Button
          label="Cancel"
          onPress={() => router.back()}
          disabled={submitting}
          variant="secondary"
          style={styles.cancelButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  balanceCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  dateButton: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  estimateCard: {
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  estimateLabel: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  estimateNote: {
    fontSize: 12,
    color: colors.muted,
  },
  textArea: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
  },
  submitButton: {
    marginBottom: 12,
  },
  cancelButton: {
    marginBottom: 12,
  },
});
