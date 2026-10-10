import { env } from './env';

export function isAllowedAttachmentUrl(value: string, production = env.NODE_ENV === 'production') {
  try {
    const url = new URL(value);
    const host = env.ATTACHMENT_CDN_HOST?.trim().toLowerCase();
    if (!host || url.hostname.toLowerCase() !== host || url.username || url.password || url.port) return false;
    if (production ? url.protocol !== 'https:' : !['https:', 'http:'].includes(url.protocol)) return false;
    return true;
  } catch { return false; }
}
