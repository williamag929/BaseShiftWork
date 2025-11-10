import { useEffect, useMemo, useState } from 'react';
import * as Network from 'expo-network';
import { scheduleService, shiftEventService } from '@/services';
import { dbService } from '@/services/db';
import { getStartOfWeek, getEndOfWeek, formatDateForApi } from '@/utils/date.utils';
import type { ScheduleShiftDto, ShiftEventDto } from '@/types/api';

export interface DashboardData {
  isOnline: boolean;
  loading: boolean;
  hoursThisWeek: number;
  shiftsThisWeek: number;
  upcoming: ScheduleShiftDto[];
  recentEvents: ShiftEventDto[];
  error?: string | null;
}

export const useDashboardData = (companyId?: string | null, personId?: number | null): DashboardData => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduleShiftDto[]>([]);
  const [recentEvents, setRecentEvents] = useState<ShiftEventDto[]>([]);

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

  useEffect(() => {
    if (!companyId || !personId) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const state = await Network.getNetworkStateAsync();
        const online = !!state.isConnected && !!state.isInternetReachable;
        if (!canceled) setIsOnline(online);

        const now = new Date();
        const weekStart = getStartOfWeek(now);
        const weekEnd = getEndOfWeek(now);
        const next7End = new Date(now);
        next7End.setDate(now.getDate() + 7);

        if (online) {
          // Fetch from API
          const [events, shiftsWeek, shiftsNext7] = await Promise.all([
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
          ]);

          // Persist to SQLite
          await dbService.upsertShiftEvents(events);
          await dbService.upsertScheduleShifts([...shiftsWeek, ...shiftsNext7]);

          if (canceled) return;
          setRecentEvents(events);
          // Merge and de-dupe by scheduleShiftId
          const byId = new Map<number, ScheduleShiftDto>();
          [...shiftsWeek, ...shiftsNext7].forEach((s) => byId.set(s.scheduleShiftId, s));
          setUpcoming(Array.from(byId.values()).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
        } else {
          // Offline: load from SQLite
          const [events, upcomingShifts] = await Promise.all([
            dbService.getEventsInRange(personId, formatDateForApi(weekStart), formatDateForApi(weekEnd)),
            dbService.getUpcomingShifts(personId, formatDateForApi(now), formatDateForApi(next7End)),
          ]);
          if (canceled) return;
          setRecentEvents(events);
          setUpcoming(upcomingShifts);
        }
      } catch (e: any) {
        if (!canceled) setError(e?.message || 'Failed to load dashboard data');
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [companyId, personId]);

  return { isOnline, loading, hoursThisWeek, shiftsThisWeek, upcoming, recentEvents, error };
};
