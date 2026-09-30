jest.mock('@/services/kiosk.service', () => ({
  kioskService: { getConfig: jest.fn() },
}));
jest.mock('@/utils/localStore', () => ({
  getJson: jest.fn(),
  setJson: jest.fn(),
}));

import { kioskService } from '@/services/kiosk.service';
import { getJson, setJson } from '@/utils/localStore';
import { STRICT_DEFAULT_CONFIG } from '@/services/punchFlow';
import { useConfigStore } from '../configStore';

const mockGetConfig = kioskService.getConfig as jest.Mock;
const mockGetJson = getJson as jest.Mock;
const mockSetJson = setJson as jest.Mock;

const LAX = { requirePin: false, requirePhoto: false, questionsOnClockOutOnly: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockSetJson.mockResolvedValue(undefined);
  useConfigStore.setState({ config: STRICT_DEFAULT_CONFIG });
});

describe('configStore', () => {
  it('starts strict: PIN and photo required', () => {
    expect(useConfigStore.getState().config).toEqual(STRICT_DEFAULT_CONFIG);
  });

  it('refresh applies the server config and caches it for this site', async () => {
    mockGetConfig.mockResolvedValue(LAX);

    await useConfigStore.getState().refresh('co-1', 3);

    expect(useConfigStore.getState().config).toEqual(LAX);
    expect(mockSetJson).toHaveBeenCalledWith('kiosk_config_v1_co-1_3', LAX);
  });

  it('refresh keeps the current config when the server cannot be reached', async () => {
    useConfigStore.setState({ config: LAX });
    mockGetConfig.mockRejectedValue(new Error('Network Error'));

    await useConfigStore.getState().refresh('co-1', 3);

    expect(useConfigStore.getState().config).toEqual(LAX);
  });

  it('a failed cache write does not lose the fresh config', async () => {
    mockGetConfig.mockResolvedValue(LAX);
    mockSetJson.mockRejectedValue(new Error('disk full'));

    await useConfigStore.getState().refresh('co-1', 3);

    expect(useConfigStore.getState().config).toEqual(LAX);
  });

  it('loadCached uses the cached config for this site', async () => {
    mockGetJson.mockResolvedValue(LAX);

    await useConfigStore.getState().loadCached('co-1', 3);

    expect(mockGetJson).toHaveBeenCalledWith('kiosk_config_v1_co-1_3');
    expect(useConfigStore.getState().config).toEqual(LAX);
  });

  it('loadCached falls back to strict when there is no cache, never keeping another site\'s lax config', async () => {
    useConfigStore.setState({ config: LAX });
    mockGetJson.mockResolvedValue(null);

    await useConfigStore.getState().loadCached('co-1', 4);

    expect(useConfigStore.getState().config).toEqual(STRICT_DEFAULT_CONFIG);
  });
});
