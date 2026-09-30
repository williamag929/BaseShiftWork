jest.mock('../api-client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import apiClient from '../api-client';
import { kioskService } from '../kiosk.service';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

class FakeFormData {
  parts: Array<[string, unknown]> = [];
  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }
}

const realFormData = (global as { FormData?: unknown }).FormData;
beforeAll(() => {
  (global as { FormData?: unknown }).FormData = FakeFormData;
});
afterAll(() => {
  (global as { FormData?: unknown }).FormData = realFormData;
});
beforeEach(() => jest.clearAllMocks());

describe('kioskService.getConfig', () => {
  it('requests the site config for the enrolled location', async () => {
    mockGet.mockResolvedValue({
      data: { requirePin: false, requirePhoto: true, questionsOnClockOutOnly: true },
    });

    const config = await kioskService.getConfig('co-1', 3);

    expect(mockGet).toHaveBeenCalledWith('/api/kiosk/co-1/config', { params: { locationId: 3 } });
    expect(config.requirePin).toBe(false);
    expect(config.requirePhoto).toBe(true);
  });
});

describe('kioskService.verifyPin', () => {
  it('fails fast (5 s) so an offline PIN screen does not hang', async () => {
    mockPost.mockResolvedValue({ data: { verified: true } });

    const ok = await kioskService.verifyPin(7, '1234');

    expect(ok).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/auth/verify-pin',
      { personId: 7, pin: '1234' },
      { timeout: 5_000 }
    );
  });
});

describe('kioskService.uploadPhoto', () => {
  it('posts the file as multipart and returns the stored url', async () => {
    mockPost.mockResolvedValue({ data: { url: 'https://s3.example/p.jpg' } });

    const url = await kioskService.uploadPhoto('co-1', 'file:///cache/p.jpg');

    expect(url).toBe('https://s3.example/p.jpg');
    const [path, form, options] = mockPost.mock.calls[0];
    expect(path).toBe('/api/kiosk/co-1/photo');
    expect((form as FakeFormData).parts).toEqual([
      ['file', { uri: 'file:///cache/p.jpg', name: 'punch.jpg', type: 'image/jpeg' }],
    ]);
    expect(options.headers['Content-Type']).toBe('multipart/form-data');
    expect(options.timeout).toBe(30_000);
  });
});

describe('kioskService.clock', () => {
  it('sends the idempotency id, real tap time and pin as given', async () => {
    mockPost.mockResolvedValue({ data: { eventLogId: 'e1' } });
    const request = {
      personId: 7,
      eventType: 'ClockIn' as const,
      kioskDevice: 'k1',
      eventLogId: 'e1',
      eventDate: '2026-09-28T10:00:00.000Z',
      pin: '1234',
    };

    await kioskService.clock('co-1', request);

    expect(mockPost).toHaveBeenCalledWith('/api/kiosk/co-1/clock', request);
  });
});
