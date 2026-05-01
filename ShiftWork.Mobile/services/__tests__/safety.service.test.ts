jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../api-client';
import { safetyService, SafetyContent } from '../safety.service';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const MOCK_CONTENT: SafetyContent = {
  safetyContentId: 's1', companyId: 'co-1', title: 'Toolbox Talk',
  description: 'Weekly safety talk', type: 'ToolboxTalk', status: 'Published',
  isAcknowledgmentRequired: true, isAcknowledgedByCurrentUser: false,
  createdAt: '2026-01-01T00:00:00Z', createdByName: 'Supervisor',
};

beforeEach(() => jest.clearAllMocks());

describe('safetyService.getContents', () => {
  it('calls correct endpoint and returns content list', async () => {
    mockGet.mockResolvedValue([MOCK_CONTENT]);

    const result = await safetyService.getContents('co-1');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/safety', { params: {} });
    expect(result).toEqual([MOCK_CONTENT]);
  });

  it('includes optional locationId and type filters', async () => {
    mockGet.mockResolvedValue([]);

    await safetyService.getContents('co-1', 5, 'Orientation');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/safety', {
      params: { locationId: 5, type: 'Orientation' },
    });
  });

  it('propagates error on failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await expect(safetyService.getContents('co-1')).rejects.toThrow('Network error');
  });
});

describe('safetyService.getPending', () => {
  it('calls /safety/pending endpoint', async () => {
    mockGet.mockResolvedValue([MOCK_CONTENT]);

    const result = await safetyService.getPending('co-1');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/safety/pending');
    expect(result).toHaveLength(1);
  });

  it('returns empty list when nothing pending', async () => {
    mockGet.mockResolvedValue([]);

    const result = await safetyService.getPending('co-1');

    expect(result).toEqual([]);
  });
});

describe('safetyService.acknowledge', () => {
  it('POSTs to /acknowledge endpoint without notes', async () => {
    mockPost.mockResolvedValue(undefined);

    await safetyService.acknowledge('co-1', 's1');

    expect(mockPost).toHaveBeenCalledWith(
      '/api/companies/co-1/safety/s1/acknowledge',
      { notes: undefined }
    );
  });

  it('POSTs with notes when provided', async () => {
    mockPost.mockResolvedValue(undefined);

    await safetyService.acknowledge('co-1', 's1', 'Understood');

    expect(mockPost).toHaveBeenCalledWith(
      '/api/companies/co-1/safety/s1/acknowledge',
      { notes: 'Understood' }
    );
  });

  it('propagates error when acknowledgment fails', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));

    await expect(safetyService.acknowledge('co-1', 's1')).rejects.toThrow('Server error');
  });
});
