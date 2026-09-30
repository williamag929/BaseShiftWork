import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { nfcService } from '../nfc.service';

const mocked = NfcManager as unknown as {
  isSupported: jest.Mock; isEnabled: jest.Mock; requestTechnology: jest.Mock; getTag: jest.Mock;
  cancelTechnologyRequest: jest.Mock; ndefHandler: { writeNdefMessage: jest.Mock; makeReadOnly: jest.Mock };
};
const ndef = Ndef as unknown as { isType: jest.Mock; uri: { decodePayload: jest.Mock }; encodeMessage: jest.Mock; uriRecord: jest.Mock };
const KEY = 'Ab3_-xyz0123456789ABCD';

beforeEach(() => {
  jest.clearAllMocks();
  mocked.isSupported.mockResolvedValue(true);
  mocked.isEnabled.mockResolvedValue(true);
  ndef.isType.mockReturnValue(true);
});

describe('getAvailability', () => {
  it('is ready when supported and enabled', async () => {
    expect(await nfcService.getAvailability()).toBe('ready');
  });
  it('is disabled when NFC is off', async () => {
    mocked.isEnabled.mockResolvedValue(false);
    expect(await nfcService.getAvailability()).toBe('disabled');
  });
  it('is unsupported without NFC hardware', async () => {
    mocked.isSupported.mockResolvedValue(false);
    expect(await nfcService.getAvailability()).toBe('unsupported');
  });
  it('is unsupported when the native module throws', async () => {
    mocked.isSupported.mockRejectedValue(new Error('no module'));
    expect(await nfcService.getAvailability()).toBe('unsupported');
  });
});

describe('readTagKey', () => {
  it('returns the key of the first Loqzen URI record and ends the session', async () => {
    mocked.getTag.mockResolvedValue({ ndefMessage: [{ tnf: 1, type: 'U', payload: [1] }] });
    ndef.uri.decodePayload.mockReturnValue(`https://t.loqzen.com/t/${KEY}`);

    await expect(nfcService.readTagKey('Hold near tag')).resolves.toBe(KEY);
    expect(mocked.requestTechnology).toHaveBeenCalledWith('Ndef', { alertMessage: 'Hold near tag' });
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('returns null for a tag that is not a Loqzen link', async () => {
    mocked.getTag.mockResolvedValue({ ndefMessage: [{ tnf: 1, type: 'U', payload: [1] }] });
    ndef.uri.decodePayload.mockReturnValue('https://example.com');
    await expect(nfcService.readTagKey('x')).resolves.toBeNull();
  });

  it('returns null for a blank tag', async () => {
    mocked.getTag.mockResolvedValue({ ndefMessage: [] });
    await expect(nfcService.readTagKey('x')).resolves.toBeNull();
  });

  it('rejects when the user cancels, and still ends the session', async () => {
    mocked.requestTechnology.mockRejectedValueOnce(new Error('cancelled'));
    await expect(nfcService.readTagKey('x')).rejects.toThrow('cancelled');
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });
});

describe('writeTagUrl', () => {
  it('writes one URI record and locks only when asked', async () => {
    ndef.encodeMessage.mockReturnValue([9, 9]);
    await nfcService.writeTagUrl(`https://t.loqzen.com/t/${KEY}`, 'Hold', false);

    expect(ndef.uriRecord).toHaveBeenCalledWith(`https://t.loqzen.com/t/${KEY}`);
    expect(mocked.ndefHandler.writeNdefMessage).toHaveBeenCalledWith([9, 9]);
    expect(mocked.ndefHandler.makeReadOnly).not.toHaveBeenCalled();
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('locks the tag after writing when asked', async () => {
    await nfcService.writeTagUrl(`https://t.loqzen.com/t/${KEY}`, 'Hold', true);
    expect(mocked.ndefHandler.makeReadOnly).toHaveBeenCalled();
  });

  it('ends the session when the write fails', async () => {
    mocked.ndefHandler.writeNdefMessage.mockRejectedValueOnce(new Error('tag lost'));
    await expect(nfcService.writeTagUrl('u', 'Hold', false)).rejects.toThrow('tag lost');
    expect(mocked.cancelTechnologyRequest).toHaveBeenCalled();
  });
});

describe('start retry', () => {
  it('retries NfcManager.start after a failed start instead of caching the rejection', async () => {
    jest.resetModules();
    const fresh = require('react-native-nfc-manager').default;
    const { nfcService: freshService } = require('../nfc.service');
    fresh.isSupported.mockResolvedValue(true);
    fresh.isEnabled.mockResolvedValue(true);
    fresh.start.mockRejectedValueOnce(new Error('nfc stack not ready'));

    expect(await freshService.getAvailability()).toBe('unsupported');
    expect(await freshService.getAvailability()).toBe('ready');
    expect(fresh.start).toHaveBeenCalledTimes(2);
  });
});
