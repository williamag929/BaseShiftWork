jest.mock('../api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

import { apiClient } from '../api-client';
import { nfcPunchService } from '../nfc-punch.service';

beforeEach(() => jest.clearAllMocks());

it('posts the tap to the company nfc-punch endpoint', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ eventType: 'clockin' });
  const req = { tagKey: 'k', eventLogId: 'id-1', eventDate: '2026-09-30T12:00:00.000Z', geoLocation: '1,2', device: 'Pixel' };

  await nfcPunchService.punch('co-1', req);

  expect(apiClient.post).toHaveBeenCalledWith('/api/companies/co-1/nfc-punch', req);
});

it('lists tag links and creates one', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue([]);
  (apiClient.post as jest.Mock).mockResolvedValue({});

  await nfcPunchService.getTagLinks('co-1');
  await nfcPunchService.createTagLink('co-1', 7);

  expect(apiClient.get).toHaveBeenCalledWith('/api/companies/co-1/locations/nfc-tags', { params: { noCacheBust: true } });
  expect(apiClient.post).toHaveBeenCalledWith('/api/companies/co-1/locations/7/nfc-tag/regenerate');
});
