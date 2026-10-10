export type MonitorRange = '1h' | 'today' | '7d' | '30d'
export type HistoryStatus = 'AVAILABLE' | 'EMPTY' | 'TRUNCATED' | 'UNAVAILABLE'
export type NullableNumber = number | null
export interface History {
  retentionDays: number; availableFrom: string; current: HistoryStatus; previous: HistoryStatus
  countsAvailableFrom: string; probeAvailableFrom: string; alertsAvailableFrom: string
  countsCurrent: HistoryStatus; countsPrevious: HistoryStatus
  probeCurrent: HistoryStatus; probePrevious: HistoryStatus
  alertsCurrent: HistoryStatus; alertsPrevious: HistoryStatus
}
export interface Summary {
  monitors: { total: number; up: number; down: number; degraded: number; paused: number; unknown: number }
  probes: { scope: 'PROJECT_ASSIGNED'; total: number; online: number }
  alertingCount: number; sslExpiringCount: number
  expiringCertificates: Array<{ monitorId: string; host: string; daysLeft: number; expiresAt: string; issuer: string | null }>
}
export interface TimelinePoint {
  time: string; durationSeconds: number; checks: NullableNumber; failures: NullableNumber
  checksPerMinute: NullableNumber; avgLatencyMs: NullableNumber
  latencyP50Ms: NullableNumber; latencyP95Ms: NullableNumber; latencyP99Ms: NullableNumber
  uptimePercent: NullableNumber; monitorCount: NullableNumber; failingCount: NullableNumber
}
export interface Dashboard {
  range: MonitorRange; tz: string; asOf: string; from: string; to: string
  previousFrom: string | null; previousTo: string | null
  metricBasis: { sampleSource: 'LOCAL'; availability: 'EFFECTIVE_SUCCESS'; latency: 'LOCAL_DURATION' }
  history: History; summary: Summary
  kpis: {
    totalChecks: NullableNumber; failedChecks: NullableNumber
    uptimePercent: NullableNumber; uptimeDeltaPercent: NullableNumber
    avgLatencyMs: NullableNumber; avgLatencyDeltaMs: NullableNumber
    p95LatencyMs: NullableNumber; p95LatencyDeltaMs: NullableNumber
    failureRatePercent: NullableNumber; failureRateDeltaPercent: NullableNumber
    monitorCount: number; monitorDelta: NullableNumber
    failingCount: number; failingDelta: NullableNumber
  }
  timeline: { interval: string; points: TimelinePoint[] }
  sparklines: Record<'uptime' | 'avgLatency' | 'p95Latency' | 'failureRate' | 'monitorCount' | 'failing', NullableNumber[]>
  distribution: {
    protocols: Array<{ type: 'HTTP' | 'TCP'; count: number }>
    probes: Array<{ id: string; name: string; scope: 'SYSTEM' | 'TENANT'; region: string; enabled: boolean; online: boolean; latencyMs: NullableNumber }>
    latencyHistogram: { unit: 'ms'; buckets: Array<{ from: number; to: number | null; count: number }> }
  }
  slowestMonitors: Array<{ id: string; name: string; target: string; type: 'HTTP' | 'TCP'; avgLatencyMs: NullableNumber; p95LatencyMs: NullableNumber; uptimePercent: NullableNumber; sparkline: NullableNumber[] }>
  recentAlerts: Array<{ id: string; monitorId: string; monitorName: string; target: string; monitorDeleted: boolean; kind: 'CONNECTIVITY' | 'AVAILABILITY' | 'SSL'; level: 'warning' | 'critical'; status: 'ongoing' | 'resolved'; suppressedReason: string | null; reason: string; threshold: NullableNumber; actual: NullableNumber; unit: string | null; message: string | null; startedAt: string; resolvedAt: string | null; updatedAt: string; durationSeconds: NullableNumber; notified: boolean }>
}
export interface Availability {
  tz: string; asOf: string; from: string; to: string
  history: { retentionDays: number; availableFrom: string; status: HistoryStatus }
  hours: number[]; days: string[]; cells: [number, number, number][]
  unavailableCells: [number, number][]
  worst: { day: string; hour: number; value: number } | null
}
export interface StatusCodes {
  tz: string; asOf: string; from: string; to: string; history: Availability['history']
  unclassifiedChecks: number; unavailableBuckets: string[]
  buckets: Array<{ time: string; httpChecks: number; success2xx: number; redirect3xx: number; clientError4xx: number; serverError5xx: number; otherStatusCode: number; noStatusCode: number }>
}
