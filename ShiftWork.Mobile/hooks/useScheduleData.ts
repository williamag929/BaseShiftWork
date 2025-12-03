import { useEffect, useState } from 'react';
import * as Network from 'expo-network';
import { scheduleService, shiftEventService } from '@/services';
import { dbService } from '@/services/db';
import { formatDateForApi } from '@/utils/date.utils';
import type { ScheduleShiftDto, ShiftEventDto } from '@/types/api';

export interface ScheduleDataResult {
  isOnline: boolean;
  loading: boolean;
  error: string | null;
  shifts: ScheduleShiftDto[];
  events: ShiftEventDto[];
}

export const useScheduleData = (
  companyId?: string | null,
  personId?: number | null,
  from?: Date,
  to?: Date
): ScheduleDataResult => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ScheduleShiftDto[]>([]);
  const [events, setEvents] = useState<ShiftEventDto[]>([]);

  useEffect(() => {
    if (!companyId || !personId || !from || !to) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const state = await Network.getNetworkStateAsync();
        const online = !!state.isConnected && !!state.isInternetReachable;
        if (!canceled) setIsOnline(online);

        if (online) {
          const [apiShifts, apiEvents] = await Promise.all([
            scheduleService.getPersonShifts(
              companyId,
              personId,
              formatDateForApi(from),
              formatDateForApi(to)
            ),
            shiftEventService.getPersonShiftEvents(companyId, personId),
          ]);

          // Persist cache and reduce events to range
          await dbService.upsertScheduleShifts(apiShifts);
          await dbService.upsertShiftEvents(apiEvents);
          const rangedEvents = apiEvents.filter(
            (e) => new Date(e.eventDate) >= from && new Date(e.eventDate) <= to
          );

          if (canceled) return;
          setShifts(apiShifts.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
          setEvents(rangedEvents.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()));
        } else {
          const [cachedShifts, cachedEvents] = await Promise.all([
            dbService.getUpcomingShifts(personId, formatDateForApi(from), formatDateForApi(to)),
            dbService.getEventsInRange(personId, formatDateForApi(from), formatDateForApi(to)),
          ]);
          if (canceled) return;
          setShifts(cachedShifts);
          setEvents(cachedEvents.reverse()); // latest first
        }
      } catch (e: any) {
        if (!canceled) setError(e?.message || 'Failed to load schedule data');
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [companyId, personId, from?.toISOString(), to?.toISOString()]);

  return { isOnline, loading, error, shifts, events };
};
