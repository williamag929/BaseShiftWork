/**
 * Centralised React Query hooks and mutations for ShiftWork data.
 *
 * Query key conventions:
 *   ['shiftEvents', companyId, personId]
 *   ['scheduleShifts', companyId, personId, start, end]
 *   ['timeOffRequests', companyId, personId]
 *   ['locationName', companyId, locationId]
 *   ['dashboard', companyId, personId]   ← wide query used by useDashboardData
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { shiftEventService, dbService } from '@/services';
import { scheduleService } from '@/services/schedule.service';
import { locationService } from '@/services/location.service';
import { timeOffRequestService } from '@/services/time-off-request.service';
import { uploadService } from '@/services/upload.service';
import { companySettingsService } from '@/services/company-settings.service';
import { getCurrentLocation, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';
import * as Device from 'expo-device';
import type { ShiftEventDto, ScheduleShiftDto } from '@/types/api';
import type { TimeOffRequest } from '@/services/time-off-request.service';

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------
export const shiftEventsKey = (companyId: string, personId: number) =>
  ['shiftEvents', companyId, personId] as const;

export const scheduleShiftsKey = (companyId: string, personId: number, start: string, end: string) =>
  ['scheduleShifts', companyId, personId, start, end] as const;

export const timeOffRequestsKey = (companyId: string, personId: number) =>
  ['timeOffRequests', companyId, personId] as const;

export const locationNameKey = (companyId: string, locationId: string | number) =>
  ['locationName', companyId, locationId] as const;

export const companyTimeZoneKey = (companyId: string) =>
  ['company-settings', companyId] as const;

// ---------------------------------------------------------------------------
// Shift events — supports offline fallback via SQLite
// ---------------------------------------------------------------------------
export function useShiftEvents(companyId?: string | null, personId?: number | null) {
  return useQuery({
    queryKey: shiftEventsKey(companyId ?? '', personId ?? 0),
    queryFn: async (): Promise<ShiftEventDto[]> => {
      try {
        const data = await shiftEventService.getPersonShiftEvents(companyId!, personId!);
        try { await dbService.upsertShiftEvents(data); } catch { /* silent */ }
        return [...data].sort(
          (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
        );
      } catch {
        // Network failure → fall back to SQLite
        const cached = await dbService.getRecentEvents(personId!, 20);
        return [...cached].sort(
          (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
        );
      }
    },
    enabled: !!companyId && !!personId,
    staleTime: 30_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Schedule shifts query
// ---------------------------------------------------------------------------
export function useScheduleShifts(
  companyId?: string | null,
  personId?: number | null,
  start?: string,
  end?: string,
) {
  return useQuery({
    queryKey: scheduleShiftsKey(companyId ?? '', personId ?? 0, start ?? '', end ?? ''),
    queryFn: (): Promise<ScheduleShiftDto[]> =>
      scheduleService.getPersonShifts(companyId!, personId!, start!, end!),
    enabled: !!companyId && !!personId && !!start && !!end,
    staleTime: 30_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Time-off requests (pending + upcoming, deduplicated)
// ---------------------------------------------------------------------------
export function useTimeOffRequests(companyId?: string | null, personId?: number | null) {
  return useQuery({
    queryKey: timeOffRequestsKey(companyId ?? '', personId ?? 0),
    queryFn: async (): Promise<TimeOffRequest[]> => {
      const [pending, upcoming] = await Promise.all([
        timeOffRequestService.getPendingTimeOff(companyId!, personId!),
        timeOffRequestService.getUpcomingTimeOff(companyId!, personId!),
      ]);
      const combined = [...pending, ...upcoming];
      const unique = combined.filter((item, idx, self) =>
        idx === self.findIndex((t) => t.timeOffRequestId === item.timeOffRequestId),
      );
      return unique.sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
    },
    enabled: !!companyId && !!personId,
    staleTime: 60_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Location name (dependent query)
// ---------------------------------------------------------------------------
export function useLocationName(companyId?: string | null, locationId?: string | number | null) {
  return useQuery({
    queryKey: locationNameKey(companyId ?? '', locationId ?? ''),
    queryFn: async (): Promise<string | null> => {
      const loc = await locationService.getLocationById(companyId!, locationId!);
      return loc?.name ?? null;
    },
    enabled: !!companyId && !!locationId,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Company timezone (from settings, cached 5 min)
// ---------------------------------------------------------------------------
export function useCompanyTimeZone(companyId?: string | null): string | null {
  const { data } = useQuery({
    queryKey: companyTimeZoneKey(companyId ?? ''),
    queryFn: () => companySettingsService.getSettings(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });
  return data?.defaultTimeZone ?? null;
}

// ---------------------------------------------------------------------------
// Clock-in / Clock-out mutation
// ---------------------------------------------------------------------------
export interface ClockMutationPayload {
  companyId: string;
  personId: number;
  isClockedIn: boolean;
  photoUri?: string | null;
}

export function useClockMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      personId,
      isClockedIn,
      photoUri,
    }: ClockMutationPayload): Promise<ShiftEventDto> => {
      const geoLocation = await getCurrentLocation();
      const kioskDevice = Device.modelName || 'mobile-device';
      let uploadedUrl: string | undefined;
      if (photoUri) uploadedUrl = await uploadService.uploadPhoto(photoUri);

      const result = isClockedIn
        ? await shiftEventService.clockOut(companyId, personId, geoLocation ?? undefined, uploadedUrl, kioskDevice)
        : await shiftEventService.clockIn(companyId, personId, geoLocation ?? undefined, uploadedUrl, kioskDevice);

      if (result.eventType === 'clockin') {
        await saveActiveClockInAt(new Date(result.eventDate).toISOString());
      } else if (result.eventType === 'clockout') {
        await clearActiveClockInAt();
      }
      return result;
    },
    onSuccess: (result, vars) => {
      // Optimistically prepend the new event to the cache
      queryClient.setQueryData<ShiftEventDto[]>(
        shiftEventsKey(vars.companyId, vars.personId),
        (prev) => [result, ...(prev ?? [])],
      );
      // Also invalidate the wide dashboard query
      queryClient.invalidateQueries({ queryKey: ['dashboard', vars.companyId, vars.personId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
}
