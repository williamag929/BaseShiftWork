jest.mock('../api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import { apiClient } from '../api-client';
import { lineupService } from '../lineup.service';
import type { Lineup, LineupCommitRequest, LineupCommitResponse } from '../../types/lineup';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('lineupService.getLineup', () => {
  it('calls the lineup endpoint with the date and returns the lineup', async () => {
    const lineup: Lineup = {
      date: '2026-10-01', timeZone: 'America/New_York', canEdit: true,
      locations: [], bench: [], unavailable: [], crews: [],
    };
    mockGet.mockResolvedValue(lineup);

    const result = await lineupService.getLineup('co-1', '2026-10-01');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/lineup?date=2026-10-01');
    expect(result).toBe(lineup);
  });

  it('propagates rejection', async () => {
    const err = new Error('403');
    mockGet.mockRejectedValue(err);
    await expect(lineupService.getLineup('co-1', '2026-10-01')).rejects.toBe(err);
  });
});

describe('lineupService.commit', () => {
  it('posts the request and returns the response', async () => {
    const request: LineupCommitRequest = {
      date: '2026-10-01',
      assignments: [{ personId: 1, locationId: 2, areaId: null, start: null, end: null, acceptWarnings: false }],
      removals: [5],
    };
    const response: LineupCommitResponse = {
      results: [{ status: 'created', personId: 1, locationId: 2, shiftId: 9, errors: [], warnings: [] }],
    };
    mockPost.mockResolvedValue(response);

    const result = await lineupService.commit('co-1', request);

    expect(mockPost).toHaveBeenCalledWith('/api/companies/co-1/lineup/commit', request);
    expect(result).toBe(response);
  });
});
