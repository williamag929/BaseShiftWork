import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
import { scheduleService, shiftEventService } from '@/services';
import { apiClient } from '@/services/api-client';
import { dbService } from '@/services/db';
import { getStartOfWeek, getEndOfWeek, formatDateForApi } from '@/utils/date.utils';
import type { ScheduleShiftDto, ShiftEventDto } from '@/types/api';

export interface DashboardData {
  isOnline: boolean;
  loading: boolean;
  refreshing: boolean;
  hoursThisWeek: number;
  shiftsThisWeek: number;
  upcoming: ScheduleShiftDto[];
  recentEvents: ShiftEventDto[];
  personStatus?: string | null;
  error?: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export const useDashboardData = (companyId?: string | null, personId?: number | null): DashboardData => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduleShiftDto[]>([]);
  const [recentEvents, setRecentEvents] = useState<ShiftEventDto[]>([]);
  const [personStatus, setPersonStatus] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const hoursThisWeek = useMemo(() => {
    // Compute hours from recent events constrained to this week
    const now = new Date();
    const start = getStartOfWeek(now);
    const end = getEndOfWeek(now);
    const events = recentEvents
      .filter((e) => new Date(e.eventDate) >= start && new Date(e.eventDate) <= end)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

    let total = 0;
    let openClockIn: ShiftEventDto | null = null;
    for (const e of events) {
      if (e.eventType === 'clock_in') {
        openClockIn = e;
      } else if (e.eventType === 'clock_out' && openClockIn) {
        const startTime = new Date(openClockIn.eventDate).getTime();
        const endTime = new Date(e.eventDate).getTime();
        if (endTime > startTime) {
          total += (endTime - startTime) / (1000 * 60 * 60);
        }
        openClockIn = null; // reset after pairing
      }
    }
    return Math.round(total * 100) / 100;
  }, [recentEvents]);

  const shiftsThisWeek = useMemo(() => {
    // Count scheduled shifts that fall within this week
    const now = new Date();
    const start = getStartOfWeek(now);
    const end = getEndOfWeek(now);
    const count = upcoming.filter((s) => {
      const startDate = new Date(s.startDate);
      return startDate >= start && startDate <= end;
    }).length;
    return count;
  }, [upcoming]);

  useEffect(() => {
    (async () => {
      try {
        await dbService.initDb();
      } catch {
        // ignore
      }
    })();
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!companyId || !personId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const state = await Network.getNetworkStateAsync();
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);

      const now = new Date();
      const weekStart = getStartOfWeek(now);
      const weekEnd = getEndOfWeek(now);
      const next7End = new Date(now);
      next7End.setDate(now.getDate() + 7);

      if (online) {
        // Fetch from API
        const [events, shiftsWeek, shiftsNext7, status] = await Promise.all([
          shiftEventService.getPersonShiftEvents(companyId, personId),
          scheduleService.getPersonShifts(
            companyId,
            personId,
            formatDateForApi(weekStart),
            formatDateForApi(weekEnd)
          ),
          scheduleService.getPersonShifts(
            companyId,
            personId,
            formatDateForApi(now),
            formatDateForApi(next7End)
          ),
          apiClient.get<string>(`/api/companies/${companyId}/people/${personId}/status`, { params: { noCacheBust: true } }),
        ]);

        // Persist to SQLite
        await dbService.upsertShiftEvents(events);
        await dbService.upsertScheduleShifts([...shiftsWeek, ...shiftsNext7]);

        // Sort recent events by most recent first
        const sortedEvents = [...events].sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
        setRecentEvents(sortedEvents);
        setPersonStatus(status ?? null);
        // Merge and de-dupe by scheduleShiftId
        const byId = new Map<number, ScheduleShiftDto>();
        [...shiftsWeek, ...shiftsNext7].forEach((s) => byId.set(s.scheduleShiftId, s));
        setUpcoming(Array.from(byId.values()).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
        setLastUpdated(new Date());
      } else {
        // Offline: load from SQLite
        const [events, upcomingShifts] = await Promise.all([
          dbService.getEventsInRange(personId, formatDateForApi(weekStart), formatDateForApi(weekEnd)),
          dbService.getUpcomingShifts(personId, formatDateForApi(now), formatDateForApi(next7End)),
        ]);
        const sortedCached = [...events].sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
        setRecentEvents(sortedCached);
        setUpcoming(upcomingShifts);
        setLastUpdated(new Date());
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [companyId, personId]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        await dbService.initDb();
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Auto-refresh every 60 seconds (configurable)
  useEffect(() => {
    const interval = 60000; // 60 seconds
    refreshIntervalRef.current = setInterval(() => {
      refresh();
    }, interval);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [refresh]);

  return { isOnline, loading, refreshing, hoursThisWeek, shiftsThisWeek, upcoming, recentEvents, personStatus, error, refresh, lastUpdated };
};
