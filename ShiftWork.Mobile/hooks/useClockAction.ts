import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { kioskService } from '@/services/kiosk.service';
import { scheduleService } from '@/services/schedule.service';
import { peopleService } from '@/services/people.service';
import { getActiveClockInAt } from '@/utils';
import { logger } from '@/utils/logger';
import { useToast } from '@/hooks/useToast';
import { useShiftEvents, useClockMutation } from './queries';
import type { KioskQuestionDto, ScheduleShiftDto } from '@/types/api';
import type { ShiftEventDto } from '@/types/api';
import { useLocationName } from './queries';

const EMPTY_EVENTS: ShiftEventDto[] = [];

export interface ClockActionData {
  events: ShiftEventDto[];
  loading: boolean;
  initializing: boolean;
  error: string | null;
  photoUri: string | null;
  cameraOpen: boolean;
  activeClockInAt: Date | null;
  elapsedSeconds: number;
  todayShift: ScheduleShiftDto | null;
  safetyQuestions: KioskQuestionDto[];
  shiftLocationName: string | null;
  isClockedIn: boolean;
  setPhotoUri: (uri: string | null) => void;
  setCameraOpen: (open: boolean) => void;
  handleClock: () => Promise<void>;
  fmtHMS: (totalSeconds: number) => string;
}

export const useClockAction = (): ClockActionData => {
  const toast = useToast();
  const { companyId, personId, name } = useAuthStore();
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeClockInAt, setActiveClockInAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ── Shift events via React Query (replaces loadEvents useEffect chain) ──
  const {
    data: events = EMPTY_EVENTS,
    isLoading: initializing,
    isError,
    error: eventsError,
  } = useShiftEvents(companyId, personId);

  const lastEvent = useMemo(() => (events.length ? events[0] : null), [events]);
  const isClockedIn = lastEvent?.eventType === 'clockin' || !!activeClockInAt;

  // ── Today's shift query ──
  const { data: todayShiftData } = useQuery({
    queryKey: ['todayShift', companyId, personId],
    queryFn: async (): Promise<ScheduleShiftDto | null> => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      const shifts = await scheduleService.getPersonShifts(
        companyId!, personId!, todayStart.toISOString(), todayEnd.toISOString(),
      );
      return shifts?.[0] ?? null;
    },
    enabled: !!companyId && !!personId,
    staleTime: 5 * 60_000,
  });
  const todayShift = todayShiftData ?? null;

  // ── Location name for today's shift (dependent query) ──
  const { data: shiftLocationName = null } = useLocationName(companyId, todayShift?.locationId);

  // ── Safety questions query ──
  const { data: safetyQuestions = [] } = useQuery({
    queryKey: ['kioskQuestions', companyId],
    queryFn: async (): Promise<KioskQuestionDto[]> => {
      const questions = await kioskService.getKioskQuestions(companyId!);
      return questions.filter((q) => q.isActive);
    },
    enabled: !!companyId,
    staleTime: 10 * 60_000,
  });

  // ── Hydrate person name if missing ──
  useEffect(() => {
    if (!companyId || !personId || name) return;
    (async () => {
      try {
        const person = await peopleService.getPersonById(companyId, personId);
        if (person) setPersonProfile({ name: person.name ?? null, email: person.email ?? null });
      } catch { /* non-critical */ }
    })();
  }, [companyId, personId, name, setPersonProfile]);

  // ── Derive activeClockInAt from events ──
  useEffect(() => {
    const latest = events[0];
    let cancelled = false;

    (async () => {
      if (latest?.eventType === 'clockin') {
        const nextActiveClockInAt = new Date(latest.eventDate);
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
  }, [events]);

  // ── Elapsed timer ──
  useEffect(() => {
    const start = activeClockInAt
      || (lastEvent?.eventType === 'clockin' ? new Date(lastEvent.eventDate) : null);
    if (!isClockedIn || !start) { setElapsedSeconds(0); return; }
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isClockedIn, activeClockInAt, lastEvent?.eventDate]);

  // ── Clock-in/out mutation ──
  const clockMutation = useClockMutation();

  const handleClock = async () => {
    if (!companyId) { toast.error('Company ID is not set.'); return; }
    if (!personId) { toast.error('Please sign in to clock in/out.'); return; }
    try {
      await clockMutation.mutateAsync({ companyId, personId, isClockedIn, photoUri });
      toast.success(isClockedIn ? 'Clocked out successfully' : 'Clocked in successfully');
    } catch (e: any) {
      const msg = e?.message || 'Clock action failed';
      logger.error('[useClockAction] handleClock error:', msg);
      toast.error(msg);
    }
  };

  const fmtHMS = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  return {
    events,
    loading: clockMutation.isPending,
    initializing,
    error: isError ? ((eventsError as Error)?.message ?? 'Failed to load events') : null,
    photoUri,
    cameraOpen,
    activeClockInAt,
    elapsedSeconds,
    todayShift,
    safetyQuestions,
    shiftLocationName,
    isClockedIn,
    setPhotoUri,
    setCameraOpen,
    handleClock,
    fmtHMS,
  };
};

