import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useLineupDraftStore } from '@/store/lineupDraftStore';
import { lineupService } from '@/services/lineup.service';
import { buildCommitRequest } from '@/utils/lineup';
import type { Lineup, LineupCommitResponse, LineupCommitResult } from '@/types/lineup';

export const lineupKey = (companyId: string, date: string) => ['lineup', companyId, date] as const;

export function shouldRetryLineup(failureCount: number, error: unknown): boolean {
  const e = error as { statusCode?: number; response?: { status?: number } } | null;
  const status = e?.statusCode ?? e?.response?.status;
  return status !== 403 && failureCount < 3;
}

export function useLineup(date: string) {
  const companyId = useAuthStore((s) => s.companyId);
  return useQuery<Lineup>({
    queryKey: lineupKey(companyId ?? '', date),
    queryFn: () => lineupService.getLineup(companyId as string, date),
    enabled: !!companyId && !!date,
    staleTime: 0,
    retry: shouldRetryLineup,
  });
}

// One commit at a time app-wide; survives hook remounts. A never-settling request
// relies on the axios timeout (30s) to clear the guard.
let inFlight: { date: string | null; companyId: string | null; promise: Promise<LineupCommitResponse> } | null = null;
export const resetLineupCommitGuard = () => {
  inFlight = null;
};

type CommitOutcome = { date: string; response: LineupCommitResponse };

export function useLineupCommit() {
  const companyId = useAuthStore((s) => s.companyId);
  const queryClient = useQueryClient();

  const mutation = useMutation<CommitOutcome, unknown, void>({
    mutationFn: async () => {
      const { date, assignments, removals, feedback } = useLineupDraftStore.getState();
      if (!date) throw new Error('No lineup date selected');
      if (!companyId) throw new Error('No company selected');
      const request = buildCommitRequest(date, { assignments, removals, feedback });
      const response = await lineupService.commit(companyId, request);
      return { date, response };
    },
    onSuccess: ({ date, response }) => {
      // Ignore results for a date the user has since left; the new draft is unrelated.
      if (useLineupDraftStore.getState().date === date) {
        useLineupDraftStore.getState().applyResults(response.results);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lineup', companyId] });
    },
  });

  const { mutateAsync } = mutation;
  const commit = useCallback((): Promise<LineupCommitResponse> => {
    const date = useLineupDraftStore.getState().date;
    const currentCompany = useAuthStore.getState().companyId;
    if (inFlight) {
      if (inFlight.date === date && inFlight.companyId === currentCompany) return inFlight.promise;
      return Promise.reject(new Error('A lineup commit for another date is still in progress'));
    }
    const promise = mutateAsync()
      .then((o) => o.response)
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });
    inFlight = { date, companyId: currentCompany, promise };
    return promise;
  }, [mutateAsync]);

  const results: LineupCommitResult[] | null = mutation.data?.response.results ?? null;
  return { commit, isPending: mutation.isPending, results, reset: mutation.reset };
}
