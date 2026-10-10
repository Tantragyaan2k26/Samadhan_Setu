export interface PublicStatsMetrics {
  totalGrievances: number;
  resolvedCount: number;
  resolutionRatePercent: number;
  avgResolutionDays: number;
  escalatedCount: number;
  citizenSatisfactionScore: number | null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parsePublicStats(payload: unknown): PublicStatsMetrics | null {
  if (!payload || typeof payload !== 'object') return null;
  const metrics = (payload as { metrics?: unknown }).metrics;
  if (!metrics || typeof metrics !== 'object') return null;
  const row = metrics as Record<string, unknown>;
  if (!finiteNumber(row.totalGrievances) || !finiteNumber(row.resolvedCount)
    || !finiteNumber(row.resolutionRatePercent) || !finiteNumber(row.avgResolutionDays)
    || !finiteNumber(row.escalatedCount)) return null;
  if (row.totalGrievances < 0 || row.resolvedCount < 0 || row.escalatedCount < 0
    || row.resolutionRatePercent < 0 || row.resolutionRatePercent > 100 || row.avgResolutionDays < 0) return null;
  if (finiteNumber(row.citizenSatisfactionScore)
    && (row.citizenSatisfactionScore < 0 || row.citizenSatisfactionScore > 5)) return null;
  return {
    totalGrievances: row.totalGrievances,
    resolvedCount: row.resolvedCount,
    resolutionRatePercent: row.resolutionRatePercent,
    avgResolutionDays: row.avgResolutionDays,
    escalatedCount: row.escalatedCount,
    citizenSatisfactionScore: finiteNumber(row.citizenSatisfactionScore) ? row.citizenSatisfactionScore : null
  };
}

export function formatPublicCount(value?: number) {
  return finiteNumber(value) ? value.toLocaleString('en-IN') : '—';
}
