import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { useScheduleGrid } from '@/hooks/useScheduleGrid';
import ScheduleGrid from '@/components/ScheduleGrid';

export default function ScheduleGridScreen() {
  const { companyId } = useAuthStore();
  const { loading, error, data, filters, setFilters, refresh } = useScheduleGrid({
    companyId,
    locationId: undefined, // TODO: allow user to select location
  });

  const handleShiftPress = (shift: any) => {
    Alert.alert(
      'Shift Details',
      `${shift.personName}\n${shift.startTime} - ${shift.endTime}\nStatus: ${shift.status}`,
      [{ text: 'OK' }]
    );
  };

  const handleAddShift = (personId: number, date: Date) => {
    Alert.alert(
      'Add Shift',
      `Add shift for Person ${personId} on ${date.toLocaleDateString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => console.log('Add shift') },
      ]
    );
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScheduleGrid
        data={data}
        filters={filters}
        onFiltersChange={setFilters}
        onShiftPress={handleShiftPress}
        onAddShift={handleAddShift}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { fontSize: 16, color: '#E74C3C', textAlign: 'center' },
});
