import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { scheduleService } from '@/services';
import { formatDate, formatTime } from '@/utils/date.utils';
import type { ScheduleShiftDto } from '@/types/api';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/services/notification.service';

interface DaySchedule {
  date: Date;
  dayName: string;
  shifts: ScheduleShiftDto[];
}

export default function WeeklyScheduleScreen() {
  const { companyId, personId } = useAuthStore();
  
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationListenerRef = useRef<Notifications.Subscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    loadWeekSchedule();
  }, [currentWeekStart, companyId, personId]);

  // Setup polling and notification listeners
  useEffect(() => {
    if (!companyId || !personId) return;

    // Start background polling (every 5 minutes)
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(() => {
        if (appStateRef.current === 'active') {
          console.log('Background polling: refreshing schedule...');
          setSilentRefreshing(true);
          loadWeekSchedule(true).finally(() => {
            setTimeout(() => setSilentRefreshing(false), 1000);
          }); // Silent refresh
        }
      }, 5 * 60 * 1000); // 5 minutes
    };

    startPolling();

    // Listen for push notifications about schedule changes
    notificationListenerRef.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.type === 'schedule_published' || 
            data?.type === 'shift_assigned' || 
            data?.type === 'shift_changed') {
          console.log('Schedule update notification received, refreshing...');
          setSilentRefreshing(true);
          loadWeekSchedule(true).finally(() => {
            setTimeout(() => setSilentRefreshing(false), 1000);
          });
        }
      }
    );

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, refresh schedule
        console.log('App resumed, refreshing schedule...');
        setSilentRefreshing(true);
        loadWeekSchedule(true).finally(() => {
          setTimeout(() => setSilentRefreshing(false), 1000);
        });
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (notificationListenerRef.current) {
        Notifications.removeNotificationSubscription(notificationListenerRef.current);
      }
      subscription.remove();
    };
  }, [companyId, personId]);

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday as start of week
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  function getWeekEnd(weekStart: Date): Date {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  function getWeekDays(weekStart: Date): DaySchedule[] {
    const days: DaySchedule[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      days.push({
        date,
        dayName: dayNames[i],
        shifts: [],
      });
    }
    
    return days;
  }

  async function loadWeekSchedule(silent: boolean = false): Promise<void> {
    if (!companyId || !personId) return;

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const weekEnd = getWeekEnd(currentWeekStart);
      
      // Fetch person shifts for this date range
      const personShifts = await scheduleService.getPersonShifts(
        companyId,
        personId,
        currentWeekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0]
      );

      // Filter for published/approved shifts only
      const publishedShifts = personShifts.filter((shift: ScheduleShiftDto) => 
        shift.status && 
        (shift.status.toLowerCase() === 'published' || shift.status.toLowerCase() === 'approved')
      );

      // Organize shifts by day
      const days = getWeekDays(currentWeekStart);
      
      publishedShifts.forEach((shift: ScheduleShiftDto) => {
        const shiftDate = new Date(shift.startDate as Date);
        shiftDate.setHours(0, 0, 0, 0);
        
        const dayIndex = days.findIndex(day => {
          const d = new Date(day.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === shiftDate.getTime();
        });
        
        if (dayIndex >= 0) {
          days[dayIndex].shifts.push(shift);
        }
      });

      setWeekSchedule(days);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('Error loading week schedule:', err);
      if (!silent) {
        setError(err.message || 'Failed to load schedule');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadWeekSchedule(false);
    setRefreshing(false);
  }

  function goToPreviousWeek() {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  }

  function goToNextWeek() {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  }

  function goToCurrentWeek() {
    setCurrentWeekStart(getWeekStart(new Date()));
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function calculateShiftHours(shift: ScheduleShiftDto): number {
    const start = new Date(shift.startDate as Date);
    const end = new Date(shift.endDate as Date);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.round(hours * 10) / 10;
  }

  const weekEnd = getWeekEnd(currentWeekStart);
  const totalHours = weekSchedule.reduce((total, day) => {
    return total + day.shifts.reduce((dayTotal, shift) => 
      dayTotal + calculateShiftHours(shift), 0
    );
  }, 0);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#4A90E2"
          title="Pull to refresh"
        />
      }
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>My Weekly Schedule</Text>
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToCurrentWeek} style={styles.weekDisplay}>
            <Text style={styles.weekText}>
              {formatDate(currentWeekStart)} - {formatDate(weekEnd)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalHours.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Total Hours</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {weekSchedule.filter(d => d.shifts.length > 0).length}
            </Text>
            <Text style={styles.statLabel}>Days Scheduled</Text>
          </View>
        </View>
        {lastUpdate && (
          <View style={styles.updateRow}>
            <Text style={styles.lastUpdateText}>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Text>
            {silentRefreshing && (
              <View style={styles.syncIndicator}>
                <Text style={styles.syncText}>🔄 Syncing...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadWeekSchedule} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && weekSchedule.length > 0 && (
        <View style={styles.schedule}>
          {weekSchedule.map((day, index) => (
            <View
              key={index}
              style={[
                styles.dayCard,
                isToday(day.date) && styles.dayCardToday,
              ]}
            >
              <View style={styles.dayHeader}>
                <Text style={[
                  styles.dayName,
                  isToday(day.date) && styles.dayNameToday,
                ]}>
                  {day.dayName}
                </Text>
                <Text style={[
                  styles.dayDate,
                  isToday(day.date) && styles.dayDateToday,
                ]}>
                  {day.date.getDate()}
                </Text>
              </View>

              {day.shifts.length === 0 ? (
                <View style={styles.noShifts}>
                  <Text style={styles.noShiftsText}>No shifts</Text>
                </View>
              ) : (
                <View style={styles.shifts}>
                  {day.shifts.map((shift) => (
                    <View key={shift.scheduleShiftId} style={styles.shiftCard}>
                      <View style={styles.shiftTime}>
                        <Text style={styles.shiftTimeText}>
                          {formatTime(shift.startDate)} - {formatTime(shift.endDate)}
                        </Text>
                        <Text style={styles.shiftHours}>
                          {calculateShiftHours(shift)}h
                        </Text>
                      </View>
                      {shift.notes && (
                        <Text style={styles.shiftNotes} numberOfLines={2}>
                          {shift.notes}
                        </Text>
                      )}
                      <View style={styles.shiftFooter}>
                        <Text style={styles.shiftStatus}>{shift.status}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
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
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  weekDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  lastUpdateText: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.8,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  schedule: {
    padding: 16,
    gap: 12,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  dayName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  dayNameToday: {
    color: '#4A90E2',
  },
  dayDate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
  },
  dayDateToday: {
    color: '#4A90E2',
  },
  noShifts: {
    padding: 24,
    alignItems: 'center',
  },
  noShiftsText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  shifts: {
    padding: 12,
    gap: 8,
  },
  shiftCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
  },
  shiftTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shiftTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  shiftHours: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
  },
  shiftNotes: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
  },
  shiftFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftStatus: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },
});
