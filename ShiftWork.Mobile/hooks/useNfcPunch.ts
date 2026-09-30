import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { nfcPunchService } from '@/services/nfc-punch.service';
import { getQuickLocation, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';
import { shiftEventsKey } from '@/hooks/queries';
import type { NfcPunchResult, ShiftEventDto } from '@/types/api';

export type NfcPunchErrorKind = 'offline' | 'unknown_tag' | 'signed_out' | 'failed';

export type NfcPunchState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'success'; result: NfcPunchResult }
  | { status: 'error'; kind: NfcPunchErrorKind; message?: string };

/** api-client rejects with { statusCode, message }; statusCode 0 means no response (offline). */
export function classifyNfcPunchError(error: unknown): NfcPunchErrorKind {
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode;
  if (statusCode === 0) return 'offline';
  if (statusCode === 404) return 'unknown_tag';
  if (statusCode === 401) return 'signed_out';
  return 'failed';
}

export function useNfcPunch(companyId: string | null, personId: number | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<NfcPunchState>({ status: 'idle' });
  // One tap = one id + tap time, kept across "Try again" so a punch the server already saved
  // (response lost to a timeout) is returned instead of recorded twice.
  const attempt = useRef<{ eventLogId: string; eventDate: string } | null>(null);
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    attempt.current = null;
    setState({ status: 'idle' });
  }, []);

  const punch = useCallback(async (tagKey: string) => {
    if (!companyId || !personId || inFlight.current) return;
    inFlight.current = true;
    attempt.current ??= { eventLogId: Crypto.randomUUID(), eventDate: new Date().toISOString() };
    setState({ status: 'sending' });

    try {
      const geoLocation = await getQuickLocation();
      const result = await nfcPunchService.punch(companyId, {
        tagKey,
        eventLogId: attempt.current.eventLogId,
        eventDate: attempt.current.eventDate,
        geoLocation: geoLocation ?? undefined,
        device: Device.modelName ?? 'mobile-device',
      });

      if (!result.repeated) {
        if (result.eventType === 'clockin') {
          await saveActiveClockInAt(new Date(result.eventDate).toISOString());
        } else {
          await clearActiveClockInAt();
        }
        const event = {
          eventLogId: result.eventLogId,
          eventDate: new Date(result.eventDate),
          eventType: result.eventType,
          companyId,
          personId,
          locationId: result.locationId,
          geofenceStatus: result.geofenceStatus,
        } as ShiftEventDto;
        queryClient.setQueryData<ShiftEventDto[]>(shiftEventsKey(companyId, personId), (prev) => [event, ...(prev ?? [])]);
        queryClient.invalidateQueries({ queryKey: ['dashboard', companyId, personId] });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState({ status: 'success', result });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState({ status: 'error', kind: classifyNfcPunchError(error), message: (error as { message?: string })?.message });
    } finally {
      inFlight.current = false;
    }
  }, [companyId, personId, queryClient]);

  return { state, punch, reset };
}
