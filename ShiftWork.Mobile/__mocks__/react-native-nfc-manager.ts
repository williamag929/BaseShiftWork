const NfcManager = {
  start: jest.fn(async () => undefined),
  isSupported: jest.fn(async () => true),
  isEnabled: jest.fn(async () => true),
  requestTechnology: jest.fn(async () => 'Ndef'),
  getTag: jest.fn(async () => null),
  cancelTechnologyRequest: jest.fn(async () => undefined),
  ndefHandler: {
    writeNdefMessage: jest.fn(async () => undefined),
    makeReadOnly: jest.fn(async () => undefined),
  },
};

export const NfcTech = { Ndef: 'Ndef' };

export const Ndef = {
  TNF_WELL_KNOWN: 0x01,
  RTD_URI: 'U',
  isType: jest.fn(() => true),
  uri: { decodePayload: jest.fn(() => '') },
  uriRecord: jest.fn((uri: string) => ({ tnf: 0x01, type: 'U', payload: [], uri })),
  encodeMessage: jest.fn(() => [] as number[]),
};

export default NfcManager;
