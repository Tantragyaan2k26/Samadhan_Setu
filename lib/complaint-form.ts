export function getStableRequestKey(
  current: { fingerprint: string; key: string } | null,
  fingerprint: string,
  nextKey: string
) {
  return current?.fingerprint === fingerprint ? current : { fingerprint, key: nextKey };
}

export function getComplaintSourceChannel(usedVoice: boolean): 'VOICE' | 'WEB' {
  return usedVoice ? 'VOICE' : 'WEB';
}
