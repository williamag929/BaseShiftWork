import { buildTagUrl, isValidTagKey, parseTagKey, NFC_TAG_URL_BASE } from '../nfcTag';

const KEY = 'Ab3_-xyz0123456789ABCD';

describe('parseTagKey', () => {
  it.each([
    [`https://t.loqzen.com/t/${KEY}`],
    [`https://t.loqzen.com/t/${KEY}/`],
    [`https://t.loqzen.com/t/${KEY}?src=nfc`],
    [`https://T.LOQZEN.COM/t/${KEY}`],
    [`  https://t.loqzen.com/t/${KEY}  `],
  ])('reads the key from %s', (url) => {
    expect(parseTagKey(url)).toBe(KEY);
  });

  it.each([
    [null],
    [undefined],
    [''],
    [`http://t.loqzen.com/t/${KEY}`],
    [`https://t.loqzen.com.evil.com/t/${KEY}`],
    [`https://evil.com/t/${KEY}`],
    [`https://t.loqzen.com/x/${KEY}`],
    ['https://t.loqzen.com/t/'],
    ['https://t.loqzen.com/t/short'],
    ['https://t.loqzen.com/t/has%20space-000000000000'],
    [`https://t.loqzen.com/t/${KEY}/extra`],
    ['https://t.loqzen.com/t/%E0%A4%A'],
  ])('rejects %s', (url) => {
    expect(parseTagKey(url as string | null | undefined)).toBeNull();
  });
});

describe('buildTagUrl / isValidTagKey', () => {
  it('builds the link the server lists', () => {
    expect(buildTagUrl(KEY)).toBe(`https://t.loqzen.com/t/${KEY}`);
    expect(NFC_TAG_URL_BASE).toBe('https://t.loqzen.com/t/');
  });

  it('validates the key shape', () => {
    expect(isValidTagKey(KEY)).toBe(true);
    expect(isValidTagKey('bad key')).toBe(false);
    expect(isValidTagKey('x'.repeat(65))).toBe(false);
  });
});
