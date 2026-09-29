import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { kioskService } from '@/services/kiosk.service';
import { commitPunch } from '@/services/punch.service';
import { nextStep, type PunchStep } from '@/services/punchFlow';
import { useConfigStore } from '@/store/configStore';
import { useDeviceStore } from '@/store/deviceStore';
import { useSessionStore } from '@/store/sessionStore';

const ROUTES = {
  pin: '/(kiosk)/pin',
  photo: '/(kiosk)/clock',
  questions: '/(kiosk)/questions',
} as const;

/**
 * Returns `goNext(from)`: call it when a step is finished. It opens the next screen the
 * site/employee needs, or records the punch and opens the success screen.
 * `from` is 'start' right after an employee is tapped.
 */
export function usePunchNavigator() {
  const router = useRouter();
  const companyId = useDeviceStore((s) => s.companyId);

  // Same key as the questions screen, so this is one shared fetch.
  const { data: questions } = useQuery({
    queryKey: ['kiosk-questions', companyId],
    queryFn: () => kioskService.getQuestions(companyId),
    staleTime: 5 * 60_000,
  });
  const questionCount = useRef(0);
  questionCount.current = questions?.length ?? 0;

  return useCallback(
    async (from: 'start' | PunchStep): Promise<void> => {
      const session = useSessionStore.getState();
      const { employee, clockType } = session;
      if (!employee || !clockType) {
        router.replace('/(kiosk)');
        return;
      }

      const step = nextStep(from, {
        config: useConfigStore.getState().config,
        employee,
        eventType: clockType,
        questionCount: questionCount.current,
      });

      if (step !== 'commit') {
        router.push(ROUTES[step]);
        return;
      }

      try {
        const { eventLogId } = await commitPunch({
          employee,
          eventType: clockType,
          pin: session.pin ?? undefined,
          photoUri: session.capturedPhotoUri ?? undefined,
          answers: session.answers,
        });
        session.setCommitted(eventLogId);
      } catch {
        // The punch could not be saved on this tablet (for example storage is full).
        session.setCommitError(true);
      }
      router.replace('/(kiosk)/success');
    },
    [router]
  );
}
