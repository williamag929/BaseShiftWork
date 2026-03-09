import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { shiftEventService, dbService } from '@/services';
import { scheduleService } from '@/services/schedule.service';
import { kioskService } from '@/services/kiosk.service';
import { locationService } from '@/services/location.service';
import { uploadService } from '@/services/upload.service';
import { peopleService } from '@/services/people.service';
import { getCurrentLocation } from '@/utils';
import { getActiveClockInAt, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';
import { logger } from '@/utils/logger';
import { useToast } from '@/hooks/useToast';
import * as Device from 'expo-device';
import type { ShiftEventDto, KioskQuestionDto, ScheduleShiftDto } from '@/types/api';

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

  const [events, setEvents] = useState<ShiftEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeClockInAt, setActiveClockInAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [todayShift, setTodayShift] = useState<ScheduleShiftDto | null>(null);
  const [safetyQuestions, setSafetyQuestions] = useState<KioskQuestionDto[]>([]);
  const [shiftLocationName, setShiftLocationName] = useState<string | null>(null);

  const lastEvent = useMemo(() => (events.length ? events[0] : null), [events]);
  const isClockedIn = lastEvent?.eventType === 'clockin' || !!activeClockInAt;

  const loadEvents = async () => {
    if (!companyId || !personId) return;
    try {
      const data = await shiftEventService.getPersonShiftEvents(companyId, personId);
      const sorted = [...data].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
      );
      setEvents(sorted);
      const latest = sorted[0];
      if (latest?.eventType === 'clockin') {
        setActiveClockInAt(new Date(latest.eventDate));
        await saveActiveClockInAt(new Date(latest.eventDate).toISOString());
      } else {
        setActiveClockInAt(null);
        await clearActiveClockInAt();
      }
    } catch {
      try {
        const cached = await dbService.getRecentEvents(personId, 10);
        const sorted = [...cached].sort(
          (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        );
        setEvents(sorted);
        const latest = sorted[0];
        if (latest?.eventType === 'clockin') {
          setActiveClockInAt(new Date(latest.eventDate));
        } else {
          const saved = await getActiveClockInAt();
          setActiveClockInAt(saved ? new Date(saved) : null);
        }
      } catch (e2: any) {
        setError(e2?.message || 'Failed to load events');
        const saved = await getActiveClockInAt();
        setActiveClockInAt(saved ? new Date(saved) : null);
      }
    } finally {
      setInitializing(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadEvents(); }, [companyId, personId]);

  // Hydrate person name if missing
  useEffect(() => {
    (async () => {
      try {
        if (companyId && personId && !name) {
          const person = await peopleService.getPersonById(companyId, personId);
          if (person) setPersonProfile({ name: person.name ?? null, email: person.email ?? null });
        }
      } catch {}
    })();
  }, [companyId, personId, name, setPersonProfile]);

  // Fetch today's shift and kiosk safety questions
  useEffect(() => {
    if (!companyId || !personId) return;
    (async () => {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const shifts = await scheduleService.getPersonShifts(
          companyId, personId, todayStart.toISOString(), todayEnd.toISOString()
        );
        const shift = shifts?.[0] ?? null;
        setTodayShift(shift);
        if (shift?.locationId) {
          try {
            const loc = await locationService.getLocationById(companyId, shift.locationId);
            setShiftLocationName(loc?.name ?? null);
          } catch { setShiftLocationName(null); }
        }
      } catch { setTodayShift(null); }
      try {
        const questions = await kioskService.getKioskQuestions(companyId);
        setSafetyQuestions(questions.filter((q) => q.isActive));
      } catch { setSafetyQuestions([]); }
    })();
  }, [companyId, personId]);

  // Elapsed timer
  useEffect(() => {
    const start = activeClockInAt || (lastEvent?.eventType === 'clockin' ? new Date(lastEvent.eventDate) : null);
    if (!isClockedIn || !start) { setElapsedSeconds(0); return; }
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isClockedIn, activeClockInAt, lastEvent?.eventDate]);

  const fmtHMS = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const handleClock = async () => {
    if (!companyId) { toast.error('Company ID is not set.'); return; }
    if (!personId) { toast.error('Please sign in to clock in/out.'); return; }
    setLoading(true);
    setError(null);
    try {
      const geoLocation = await getCurrentLocation();
      const kioskDevice = Device.modelName || 'mobile-device';
      let uploadedUrl: string | undefined;
      if (photoUri) uploadedUrl = await uploadService.uploadPhoto(photoUri);
      const result = isClockedIn
        ? await shiftEventService.clockOut(companyId, personId, geoLocation || undefined, uploadedUrl, kioskDevice)
        : await shiftEventService.clockIn(companyId, personId, geoLocation || undefined, uploadedUrl, kioskDevice);
      setEvents((prev) => [result, ...prev]);
      if (result.eventType === 'clockin') {
        setActiveClockInAt(new Date(result.eventDate));
        await saveActiveClockInAt(new Date(result.eventDate).toISOString());
      } else if (result.eventType === 'clockout') {
        setActiveClockInAt(null);
        await clearActiveClockInAt();
      }
      toast.success(isClockedIn ? 'Clocked out successfully' : 'Clocked in successfully');
    } catch (e: any) {
      const msg = e?.message || 'Clock action failed';
      setError(msg);
      logger.error('[useClockAction] handleClock error:', msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    events, loading, initializing, error, photoUri, cameraOpen,
    activeClockInAt, elapsedSeconds, todayShift, safetyQuestions, shiftLocationName,
    isClockedIn, setPhotoUri, setCameraOpen, handleClock, fmtHMS,
  };
};
