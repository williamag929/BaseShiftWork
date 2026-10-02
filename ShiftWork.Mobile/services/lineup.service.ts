import { apiClient } from './api-client';
import type { Lineup, LineupCommitRequest, LineupCommitResponse } from '../types/lineup';

export const lineupService = {
  async getLineup(companyId: string, date: string): Promise<Lineup> {
    return apiClient.get<Lineup>(`/api/companies/${companyId}/lineup?date=${date}`);
  },

  async commit(companyId: string, request: LineupCommitRequest): Promise<LineupCommitResponse> {
    return apiClient.post<LineupCommitResponse>(`/api/companies/${companyId}/lineup/commit`, request);
  },
};
