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
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available PTO Balance</Text>
          <Text style={styles.balanceValue}>{ptoBalance.toFixed(2)} hours</Text>
        </View>
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

        <View style={styles.estimateCard}>
          <Text style={styles.estimateLabel}>Estimated Hours</Text>
          <Text style={styles.estimateValue}>{estimatedHours} hours</Text>
          <Text style={styles.estimateNote}>
            Based on {timeOffRequestService.calculateBusinessDays(startDate, endDate)} business days
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Reason (Optional)</Text>
          <TextInput
            style={styles.textArea}
            value={reason}
            onChangeText={setReason}
            placeholder="Why are you requesting time off?"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Request</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
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
    color: '#666',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
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
    color: '#333',
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
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  typeButtonActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  dateButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  estimateCard: {
    backgroundColor: '#E8F4FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  estimateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  estimateNote: {
    fontSize: 12,
    color: '#666',
  },
  textArea: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: '#27AE60',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
