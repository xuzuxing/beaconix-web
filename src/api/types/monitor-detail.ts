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

/** 单次检查批次（round）详情中的检查行：在 CheckLog 基础上补充批次诊断字段 */
export interface MonitorRoundCheck extends CheckLog {
  revision: number
  /** false 表示执行被阻断，不参与可用率统计 */
  evaluated: boolean
  failureKind: string | null
  /** 协议诊断元数据，字段受后端约束、不含敏感信息 */
  meta: Record<string, unknown>
  roundId: string | null
}

export type ProbeScope = 'SYSTEM' | 'TENANT'
export type ProbeProvider = 'TENCENT' | 'ALIYUN' | 'CUSTOM'
export type ProbeOnlineStatus = 'ONLINE' | 'OFFLINE'

export interface MonitorRoundProbe {
  id: string
  name: string
  scope: ProbeScope
  provider: ProbeProvider
  region: string
  status: ProbeOnlineStatus
  enabled: boolean
  lastHeartbeat: string | null
}

export interface MonitorRoundResult {
  id: string
  probeId: string
  /** 探针上报后被删除时为 null */
  probe: MonitorRoundProbe | null
  success: boolean
  error: string | null
  latency: number
  statusCode: number | null
  target: string
  checkedAt: string
  receivedAt: string
  /** 已结算（纳入汇总）时才有值；null 表示被忽略（过期 / 孤儿 / 落选） */
  appliedAt: string | null
}

export type RoundDecision =
  | 'RESCUED'
  | 'OVERTURNED'
  | 'CONFIRMED_SUCCESS'
  | 'CONFIRMED_FAILURE'
  | 'FALLBACK_LOCAL'

export type RoundProtectedReason =
  | 'LEGACY_UNSUPPORTED'
  | 'UNEVALUATED'
  | 'ASSERTION'
  | 'SSL'

export interface MonitorRoundAggregation {
  /** 受保护批次仅以本地判定结算 */
  protected: boolean
  protectedReason: RoundProtectedReason | null
  /** 参与分母的在线租户探针数 */
  effectiveProbeCount: number
  /** 参与投票的样本数（每个探针最多一票） */
  sampleCount: number
  successCount: number
  ratio: number
  threshold: number
  decision: RoundDecision
  settledAt: string
}

export interface MonitorRound {
  roundId: string
  /** false 表示批次仍在收集探针上报（appliedAt 为 null） */
  settled: boolean
  check: MonitorRoundCheck
  /** 批次未结算时为 null */
  aggregation: MonitorRoundAggregation | null
  results: MonitorRoundResult[]
}
