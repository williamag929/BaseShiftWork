jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../api-client';
import { bulletinService, Bulletin } from '../bulletin.service';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

const MOCK_BULLETIN: Bulletin = {
  bulletinId: 'b1', companyId: 'co-1', title: 'Test', content: 'Body',
  type: 'General', priority: 'Normal', status: 'Published',
  isReadByCurrentUser: false, totalReads: 0,
  publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', createdByName: 'Admin',
};

beforeEach(() => jest.clearAllMocks());

describe('bulletinService.getBulletins', () => {
  it('calls correct endpoint and returns bulletins', async () => {
    mockGet.mockResolvedValue([MOCK_BULLETIN]);

    const result = await bulletinService.getBulletins('co-1');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/bulletins', { params: {} });
    expect(result).toEqual([MOCK_BULLETIN]);
  });

  it('includes optional filters in params', async () => {
    mockGet.mockResolvedValue([]);

    await bulletinService.getBulletins('co-1', 42, 'Urgent', 'Published');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/bulletins', {
      params: { locationId: 42, type: 'Urgent', status: 'Published' },
    });
  });

  it('propagates API errors', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await expect(bulletinService.getBulletins('co-1')).rejects.toThrow('Network error');
  });
});

describe('bulletinService.getUnread', () => {
  it('calls /bulletins/unread endpoint', async () => {
    mockGet.mockResolvedValue([MOCK_BULLETIN]);

    const result = await bulletinService.getUnread('co-1');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/bulletins/unread', { params: {} });
    expect(result).toHaveLength(1);
  });

  it('passes urgentOnly param when true', async () => {
    mockGet.mockResolvedValue([]);

    await bulletinService.getUnread('co-1', true);

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/bulletins/unread', {
      params: { urgentOnly: true },
    });
  });
});

describe('bulletinService.markAsRead', () => {
  it('POSTs to /read endpoint', async () => {
    mockPost.mockResolvedValue(undefined);

    await bulletinService.markAsRead('co-1', 'b1');

    expect(mockPost).toHaveBeenCalledWith('/api/companies/co-1/bulletins/b1/read');
  });

  it('propagates error on failure', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));

    await expect(bulletinService.markAsRead('co-1', 'b1')).rejects.toThrow('Server error');
  });
});

describe('bulletinService.archive', () => {
  it('DELETEs the bulletin', async () => {
    mockDelete.mockResolvedValue(undefined);

    await bulletinService.archive('co-1', 'b1');

    expect(mockDelete).toHaveBeenCalledWith('/api/companies/co-1/bulletins/b1');
  });
});
