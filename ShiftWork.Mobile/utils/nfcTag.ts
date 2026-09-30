export const NFC_TAG_HOST = 't.loqzen.com';
export const NFC_TAG_URL_BASE = `https://${NFC_TAG_HOST}/t/`;

// Server keys are 22-char base64url; allow up to the 64-char column for future formats.
const TAG_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const TAG_URL_PATTERN = /^https:\/\/t\.loqzen\.com\/t\/([^/?#]+)\/?(?:[?#].*)?$/i;

export function isValidTagKey(tagKey: string): boolean {
  return TAG_KEY_PATTERN.test(tagKey);
}

export function buildTagUrl(tagKey: string): string {
  return NFC_TAG_URL_BASE + tagKey;
}

/** The tag key from a Loqzen tag link (https://t.loqzen.com/t/<key>), or null for anything else. */
export function parseTagKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = TAG_URL_PATTERN.exec(url.trim());
  if (!match) return null;
  let key: string;
  try {
    key = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return isValidTagKey(key) ? key : null;
}
