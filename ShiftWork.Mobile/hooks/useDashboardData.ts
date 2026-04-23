import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import * as Network from 'expo-network';
import { scheduleService, shiftEventService } from '@/services';
import { bulletinService } from '@/services/bulletin.service';
import { safetyService } from '@/services/safety.service';
import { apiClient } from '@/services/api-client';
import { dbService } from '@/services/db';
import { getStartOfWeekUTC, getEndOfWeekUTC, formatDateForApi } from '@/utils/date.utils';
import { ShiftEventTypes } from '@/types/api';
import type { ScheduleShiftDto, ShiftEventDto } from '@/types/api';
import type { TimeOffRequest } from '@/services/time-off-request.service';
import { getActiveClockInAt } from '@/utils';
import { logger } from '@/utils/logger';
import { useCompanyTimeZone, useTimeOffRequests, useLocationName } from './queries';

// ---------------------------------------------------------------------------
// Pure async function — orchestrates all dashboard fetches with offline fallback
// ---------------------------------------------------------------------------
interface DashboardQueryData {
  recentEvents: ShiftEventDto[];
  upcoming: ScheduleShiftDto[];
  personStatus: string | null;
  isOnline: boolean;
}

const EMPTY_EVENTS: ShiftEventDto[] = [];
const EMPTY_SHIFTS: ScheduleShiftDto[] = [];

async function fetchDashboardData(companyId: string, personId: number): Promise<DashboardQueryData> {
  await dbService.initDb().catch(() => {});

  const state = await Network.getNetworkStateAsync();
  const online = !!state.isConnected && !!state.isInternetReachable;

  const now = new Date();
  const weekStart = getStartOfWeekUTC(now);
  const weekEnd = getEndOfWeekUTC(now);
  const next7End = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));

  if (online) {
    const [events, shiftsWeek, shiftsNext7, status] = await Promise.all([
      shiftEventService.getPersonShiftEvents(companyId, personId),
      scheduleService.getPersonShifts(companyId, personId, formatDateForApi(weekStart), formatDateForApi(weekEnd)),
      scheduleService.getPersonShifts(companyId, personId, formatDateForApi(now), formatDateForApi(next7End)),
      apiClient
        .get<string>(`/api/companies/${companyId}/people/${personId}/status`, { params: { noCacheBust: true } })
        .catch(() => null),
    ]);
    await Promise.allSettled([
      dbService.upsertShiftEvents(events),
      dbService.upsertScheduleShifts([...shiftsWeek, ...shiftsNext7]),
    ]);
    const sortedEvents = [...events].sort(
      (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
    );
    const byId = new Map<number, ScheduleShiftDto>();
    [...shiftsWeek, ...shiftsNext7].forEach((s) => byId.set(s.scheduleShiftId, s));
    const sortedUpcoming = Array.from(byId.values()).sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
    return { recentEvents: sortedEvents, upcoming: sortedUpcoming, personStatus: status as string | null, isOnline: true };
  } else {
    const [events, upcomingShifts] = await Promise.all([
      dbService.getEventsInRange(personId, formatDateForApi(weekStart), formatDateForApi(weekEnd)),
      dbService.getUpcomingShifts(personId, formatDateForApi(now), formatDateForApi(next7End)),
    ]);
    const sortedCached = [...events].sort(
      (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
    );
    return { recentEvents: sortedCached, upcoming: upcomingShifts, personStatus: null, isOnline: false };
  }
}

// ---------------------------------------------------------------------------
// Public hook interface — identical to original so no consuming code changes
// ---------------------------------------------------------------------------
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
  timeOffRequests: TimeOffRequest[];
  timeOffLoading: boolean;
  activeClockInAt: Date | null;
  elapsedSeconds: number;
  isClockedIn: boolean;
  todayShift: ScheduleShiftDto | null;
  todayShiftLocationName: string | null;
  companyTimeZone: string | null;
  unreadBulletins: number;
  pendingSafety: number;
}

export const useDashboardData = (
  companyId?: string | null,
  personId?: number | null,
): DashboardData => {
  const [activeClockInAt, setActiveClockInAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ── Main dashboard query (replaces manual fetchData + auto-refresh interval) ──
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['dashboard', companyId, personId],
    queryFn: () => fetchDashboardData(companyId!, personId!),
    enabled: !!companyId && !!personId,
    staleTime: 30_000,
    refetchInterval: 60_000,   // replaces the setInterval auto-refresh
    retry: 1,
  });

  // ── Time-off requests ──
  const { data: timeOffRequests = [], isLoading: timeOffLoading } = useTimeOffRequests(
    companyId,
    personId,
  );

  // ── Content KPIs ──
  const { data: unreadBulletins = 0 } = useQuery({
    queryKey: ['dashboard-unread-bulletins', companyId, personId],
    enabled: !!companyId && !!personId,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const data = await bulletinService.getUnread(companyId!);
        return data.length;
      } catch {
        return 0;
      }
    },
  });

  const { data: pendingSafety = 0 } = useQuery({
    queryKey: ['dashboard-pending-safety', companyId, personId],
    enabled: !!companyId && !!personId,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const data = await safetyService.getPending(companyId!);
        return data.length;
      } catch {
        return 0;
      }
    },
  });

  const recentEvents = data?.recentEvents ?? EMPTY_EVENTS;
  const upcoming = data?.upcoming ?? EMPTY_SHIFTS;
  const isOnline = data?.isOnline ?? true;
  const personStatus = data?.personStatus ?? null;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const latestEventType = recentEvents[0]?.eventType ?? null;
  const latestEventDate = recentEvents[0]?.eventDate ?? null;

  // ── Today's shift (memoised) ──
  const todayShift = useMemo(() => {
    if (!upcoming.length) return null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    return (
      upcoming.find((s) => {
        const start = new Date(s.startDate);
        return start >= todayStart && start < todayEnd;
      }) ?? null
    );
  }, [upcoming]);

  // ── Location name for today's shift (dependent query via shared hook) ──
  const { data: todayShiftLocationName = null } = useLocationName(
    companyId,
    todayShift?.locationId,
  );

  // ── Company timezone for shift time display ──
  const companyTimeZone = useCompanyTimeZone(companyId);

  // ── Derived clock state ──
  const isClockedIn = useMemo(() => {
    const latest = recentEvents?.[0];
    if (latest?.eventType === ShiftEventTypes.ClockIn) return true;
    return !!activeClockInAt;
  }, [recentEvents, activeClockInAt]);

  // ── Weekly stats ──
  const hoursThisWeek = useMemo(() => {
    const now = new Date();
    const start = getStartOfWeekUTC(now);
    const end = getEndOfWeekUTC(now);
    const events = recentEvents
      .filter((e) => new Date(e.eventDate) >= start && new Date(e.eventDate) <= end)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

    let total = 0;
    let openClockIn: ShiftEventDto | null = null;
    for (const e of events) {
      if (e.eventType === ShiftEventTypes.ClockIn) {
        openClockIn = e;
      } else if (e.eventType === ShiftEventTypes.ClockOut && openClockIn) {
        const s = new Date(openClockIn.eventDate).getTime();
        const en = new Date(e.eventDate).getTime();
        if (en > s) total += (en - s) / (1000 * 60 * 60);
        openClockIn = null;
      }
    }
    return Math.round(total * 100) / 100;
  }, [recentEvents]);

  const shiftsThisWeek = useMemo(() => {
    const now = new Date();
    const start = getStartOfWeekUTC(now);
    const end = getEndOfWeekUTC(now);
    return upcoming.filter((s) => {
      const startDate = new Date(s.startDate);
      return startDate >= start && startDate <= end;
    }).length;
  }, [upcoming]);

  // ── Derive activeClockInAt from recentEvents ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextActiveClockInAt = latestEventType === ShiftEventTypes.ClockIn && latestEventDate
        ? new Date(latestEventDate)
        : (() => null)();

      if (nextActiveClockInAt) {
        if (cancelled) return;
        setActiveClockInAt((previous) => {
          const previousTime = previous?.getTime() ?? null;
          const nextTime = nextActiveClockInAt.getTime();
          return previousTime === nextTime ? previous : nextActiveClockInAt;
        });
      } else {
        const saved = await getActiveClockInAt();
        if (cancelled) return;

        const nextSavedClockInAt = saved ? new Date(saved) : null;
        setActiveClockInAt((previous) => {
          const previousTime = previous?.getTime() ?? null;
          const nextTime = nextSavedClockInAt?.getTime() ?? null;
          return previousTime === nextTime ? previous : nextSavedClockInAt;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [latestEventType, latestEventDate]);

  // ── Elapsed timer (1-second tick) ──
  useEffect(() => {
    if (!isClockedIn || !activeClockInAt) {
      setElapsedSeconds(0);
      return;
    }
    const update = () => {
      const ms = Date.now() - activeClockInAt.getTime();
      setElapsedSeconds(Math.max(0, Math.floor(ms / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isClockedIn, activeClockInAt]);

  const refresh = async () => {
    try { await refetch(); } catch (e) {
      logger.error('[useDashboardData] refresh error:', e);
    }
  };

  return {
    isOnline,
    loading: isLoading,
    refreshing: isFetching && !isLoading,
    hoursThisWeek,
    shiftsThisWeek,
    upcoming,
    recentEvents,
    personStatus,
    error: isError ? ((queryError as Error)?.message ?? 'Failed to load') : null,
    refresh,
    lastUpdated,
    timeOffRequests,
    timeOffLoading,
    activeClockInAt,
    elapsedSeconds,
    isClockedIn,
    todayShift,
    todayShiftLocationName,
    companyTimeZone,
    unreadBulletins,
    pendingSafety,
  };
};


