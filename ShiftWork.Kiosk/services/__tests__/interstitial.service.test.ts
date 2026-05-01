jest.mock('../api-client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import apiClient from '../api-client';
import { interstitialService, PostClockoutPayload } from '../interstitial.service';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const MOCK_PAYLOAD: PostClockoutPayload = {
  urgentBulletins: [
    { bulletinId: 'b1', title: 'Safety Alert', content: 'Wear PPE', priority: 'High', type: 'Safety' },
  ],
  pendingSafety: [
    { safetyContentId: 's1', title: 'Toolbox Talk', description: 'Weekly safety', type: 'ToolboxTalk', isAcknowledgmentRequired: true },
  ],
};

beforeEach(() => jest.clearAllMocks());

describe('interstitialService.getPostClockout', () => {
  it('calls correct endpoint and returns payload', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAYLOAD });

    const result = await interstitialService.getPostClockout('co-1', 42);

    expect(mockGet).toHaveBeenCalledWith(
      '/api/kiosk/co-1/post-clockout',
      { params: { personId: 42 } }
    );
    expect(result.urgentBulletins).toHaveLength(1);
    expect(result.pendingSafety).toHaveLength(1);
  });

  it('includes locationId when provided', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAYLOAD });

    await interstitialService.getPostClockout('co-1', 42, 7);

    expect(mockGet).toHaveBeenCalledWith(
      '/api/kiosk/co-1/post-clockout',
      { params: { personId: 42, locationId: 7 } }
    );
  });

  it('returns empty lists when no post-clockout content', async () => {
    const emptyPayload: PostClockoutPayload = { urgentBulletins: [], pendingSafety: [] };
    mockGet.mockResolvedValue({ data: emptyPayload });

    const result = await interstitialService.getPostClockout('co-1', 42);

    expect(result.urgentBulletins).toHaveLength(0);
    expect(result.pendingSafety).toHaveLength(0);
  });

  it('propagates error on API failure (fallback scenario)', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await expect(interstitialService.getPostClockout('co-1', 42)).rejects.toThrow('Network error');
  });
});

describe('interstitialService.markBulletinRead', () => {
  it('POSTs to correct endpoint with personId param', async () => {
    mockPost.mockResolvedValue({});

    await interstitialService.markBulletinRead('co-1', 'b1', 42);

    expect(mockPost).toHaveBeenCalledWith(
      '/api/kiosk/co-1/bulletins/b1/mark-read',
      null,
      { params: { personId: 42 } }
    );
  });

  it('propagates error when mark-read fails', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));

    await expect(interstitialService.markBulletinRead('co-1', 'b1', 42)).rejects.toThrow('Server error');
  });
});

describe('interstitialService.acknowledgeSafety', () => {
  it('POSTs to correct endpoint with personId param', async () => {
    mockPost.mockResolvedValue({});

    await interstitialService.acknowledgeSafety('co-1', 's1', 42);

    expect(mockPost).toHaveBeenCalledWith(
      '/api/kiosk/co-1/safety/s1/acknowledge',
      null,
      { params: { personId: 42 } }
    );
  });

  it('propagates error when acknowledgment fails', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));

    await expect(interstitialService.acknowledgeSafety('co-1', 's1', 42)).rejects.toThrow('Server error');
  });
});
