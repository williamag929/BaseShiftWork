jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../api-client';
import { shiftEventService } from '../shift-event.service';

const mockPost = apiClient.post as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('shiftEventService.clockIn', () => {
  it('includes locationId in the payload when provided', async () => {
    mockPost.mockResolvedValue({ eventLogId: 'e1' });

    await shiftEventService.clockIn('co-1', 42, '40.7,-74.0', 'https://photo', 'iPhone', 7);

    expect(mockPost).toHaveBeenCalledWith(
      '/api/companies/co-1/shiftevents',
      expect.objectContaining({ locationId: 7, geoLocation: '40.7,-74.0' }),
    );
  });

  it('omits locationId when not provided', async () => {
    mockPost.mockResolvedValue({ eventLogId: 'e1' });

    await shiftEventService.clockIn('co-1', 42, '40.7,-74.0');

    const payload = mockPost.mock.calls[0][1];
    expect(payload.locationId).toBeUndefined();
  });
});

describe('shiftEventService.clockOut', () => {
  it('includes locationId in the payload when provided', async () => {
    mockPost.mockResolvedValue({ eventLogId: 'e2' });

    await shiftEventService.clockOut('co-1', 42, '40.7,-74.0', undefined, 'iPhone', 7);

    expect(mockPost).toHaveBeenCalledWith(
      '/api/companies/co-1/shiftevents',
      expect.objectContaining({ locationId: 7, eventType: 'clockout' }),
    );
  });
});
