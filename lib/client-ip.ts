import { isIP } from 'node:net';
import { env } from './env';

export function getClientIp(headers: Headers): string {
  const hops = env.TRUSTED_PROXY_HOPS;
  if (hops > 0) {
    const forwarded = headers.get('x-forwarded-for');
    if (!forwarded) return 'unknown';
    const chain = forwarded.split(',').map(value => value.trim());
    if (chain.some(value => !value || isIP(value) === 0) || chain.length <= hops) return 'unknown';
    return chain[chain.length - hops - 1];
  }
  if (env.TRUST_PROXY === 'true') {
    const realIp = headers.get('x-real-ip')?.trim();
    if (realIp && isIP(realIp)) return realIp;
  }
  return 'unknown';
}
