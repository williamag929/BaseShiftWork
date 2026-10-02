import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useLineupDraftStore } from '@/store/lineupDraftStore';
import { lineupService } from '@/services/lineup.service';
import { buildCommitRequest } from '@/utils/lineup';
import type { Lineup, LineupCommitResponse, LineupCommitResult } from '@/types/lineup';

export const lineupKey = (companyId: string, date: string) => ['lineup', companyId, date] as const;

export function useLineup(date: string) {
  const companyId = useAuthStore((s) => s.companyId);
  return useQuery<Lineup>({
    queryKey: lineupKey(companyId ?? '', date),
    queryFn: () => lineupService.getLineup(companyId as string, date),
    enabled: !!companyId && !!date,
    staleTime: 0,
    retry: (failureCount, error) => {
      const status = (error as { statusCode?: number; response?: { status?: number } })?.statusCode
        ?? (error as { response?: { status?: number } })?.response?.status;
      return status !== 403 && failureCount < 3;
    },
  });
}

export function useLineupCommit() {
  const companyId = useAuthStore((s) => s.companyId);
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  const mutation = useMutation<LineupCommitResponse, unknown, void>({
    mutationFn: async () => {
      const { date, assignments, removals, feedback } = useLineupDraftStore.getState();
      if (!date) throw new Error('No lineup date selected');
      if (!companyId) throw new Error('No company selected');
      const request = buildCommitRequest(date, { assignments, removals, feedback });
      return lineupService.commit(companyId, request);
    },
    onSuccess: (response) => {
      useLineupDraftStore.getState().applyResults(response.results);
      queryClient.invalidateQueries({ queryKey: ['lineup', companyId] });
    },
  });

  const { mutateAsync } = mutation;
  const commit = useCallback(async (): Promise<LineupCommitResponse> => {
    if (inFlight.current) return undefined as unknown as LineupCommitResponse;
    inFlight.current = true;
    try {
      return await mutateAsync();
    } finally {
      inFlight.current = false;
    }
  }, [mutateAsync]);

  const results: LineupCommitResult[] | null = mutation.data?.results ?? null;
  return { commit, isPending: mutation.isPending, results };
}
