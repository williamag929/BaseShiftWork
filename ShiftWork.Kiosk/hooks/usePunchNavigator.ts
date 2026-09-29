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
  // Note: if the questions query has not loaded yet, the questions step is skipped (accepted).
  const questionCount = useRef(0);
  questionCount.current = questions?.length ?? 0;

  return useCallback(
    async (from: 'start' | PunchStep): Promise<void> => {
      const session = useSessionStore.getState();
      const { employee, clockType } = session;
      if (!employee || !clockType) {
        router.dismissTo('/(kiosk)');
        return;
      }

      const step = nextStep(from, {
        config: useConfigStore.getState().config,
        employee,
        eventType: clockType,
        questionCount: questionCount.current,
      });

      if (step !== 'commit') {
        // Only one flow screen may sit above the employee list: push from the list, swap after.
        if (from === 'start') router.push(ROUTES[step]);
        else router.replace(ROUTES[step]);
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
      if (from === 'start') router.push('/(kiosk)/success');
      else router.replace('/(kiosk)/success');
    },
    [router]
  );
}
