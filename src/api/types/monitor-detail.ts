import type { CheckLog, MonitorStatus } from '../types'
import type { Dashboard, HistoryStatus, NullableNumber } from './monitoring'

export type MonitorDetailRange = '1h' | '24h' | '7d' | '30d'
export interface MonitorInsights {
  monitorId: string
  range: MonitorDetailRange
  tz: string
  asOf: string
  from: string
  to: string
  metricBasis: Dashboard['metricBasis']
  history: {
    retentionDays: number
    availableFrom: string
    status: HistoryStatus
    alertsAvailableFrom: string
    alertsStatus: HistoryStatus
  }
  latest: {
    status: MonitorStatus
    failCount: number
    lastCheckAt: string | null
    lastLatency: number | null
    lastError: string | null
    ongoingCount: number
  }
  metrics: {
    totalChecks: NullableNumber
    failedChecks: NullableNumber
    rescuedChecks: NullableNumber
    uptimePercent: NullableNumber
    avgLatencyMs: NullableNumber
    p50LatencyMs: NullableNumber
    p95LatencyMs: NullableNumber
    p99LatencyMs: NullableNumber
  }
  timeline: {
    interval: string
    points: Array<{
      time: string
      durationSeconds: number
      checks: NullableNumber
      failures: NullableNumber
      avgLatencyMs: NullableNumber
      latencyP50Ms: NullableNumber
      latencyP95Ms: NullableNumber
      latencyP99Ms: NullableNumber
      uptimePercent: NullableNumber
    }>
  }
  checks: Omit<CheckLog, 'monitorId'>[]
  checksLimit: number
  eventsLimit: number
  events: Array<Dashboard['recentAlerts'][number] & { origin: 'BASELINE' | 'OBSERVED' }>
}
