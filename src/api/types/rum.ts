/** RUM management API types. Dates are serialized ISO strings. */
export interface RumApp {
  id: string
  organizationId: string
  projectId: string
  name: string
  platform: 'WEB'
  publicKey: string
  enabled: boolean
  createdById: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
export interface RumAppInput {
  name: string
  platform?: 'WEB'
}

export interface RumPage<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
export interface RumErrorGroup {
  id: string
  appId: string
  fingerprint: string
  fingerprintVersion: number
  type: string
  category: RumErrorCategory | null
  level: RumErrorLevel | null
  message: string
  stack: string | null
  resolvedStack: string | null
  page: string | null
  release: string | null
  replaySessionId: string | null
  sourceMapApplied: boolean
  count: number
  status: RumErrorStatus
  ignoredUntil: string | null
  assigneeId: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  reopenedAt: string | null
  firstSeenAt: string
  lastSeenAt: string
  firstOccurredAt: string | null
  lastOccurredAt: string | null
  createdAt: string
  updatedAt: string
}
export type RumErrorStatus = 'UNRESOLVED' | 'RESOLVED' | 'IGNORED'
export type RumErrorCategory = 'JAVASCRIPT' | 'PROMISE' | 'RESOURCE' | 'HTTP' | 'VUE' | 'MANUAL'
export type RumErrorLevel = 'INFO' | 'WARNING' | 'ERROR' | 'FATAL'
export interface RumBreadcrumb {
  type: string
  category?: string
  level?: RumErrorLevel
  occurredAt: string
  data?: Record<string, unknown>
}
export interface RumErrorOccurrence {
  id: string
  appId: string
  groupId: string
  clientEventId: string | null
  category: RumErrorCategory
  level: RumErrorLevel
  type: string
  message: string
  stack: string | null
  resolvedStack: string | null
  sourceMapApplied: boolean
  page: string | null
  release: string | null
  sessionId: string | null
  endUserId: string | null
  anonymousId: string | null
  requestId: string | null
  http: Record<string, unknown> | null
  resource: Record<string, unknown> | null
  vue: Record<string, unknown> | null
  breadcrumbs: RumBreadcrumb[]
  sdk: Record<string, unknown> | null
  occurredAt: string | null
  receivedAt: string
}
export interface RumErrorNote {
  id: string
  appId: string
  groupId: string
  authorId: string | null
  author?: { id: string; name: string; email: string } | null
  body: string
  createdAt: string
  updatedAt: string
}
export interface RumEvent {
  id: string
  eventName: string
  endUserId: string | null
  anonymousId: string | null
  sessionId: string | null
  release: string | null
  page: string | null
  properties: unknown
  occurredAt: string | null
  receivedAt: string
}
export interface RumEventStats {
  days: number
  eventName: string | null
  total: number
  uniqueActors: number
  uniqueSessions: number
  daily: { day: string; count: number }[]
  topEvents: { eventName: string; count: number }[]
}
export interface RumReplaySession {
  id: string
  sessionKey: string
  release: string | null
  page: string | null
  startedAt: string
  lastSeenAt: string
  chunkCount: number
  eventCount: number
  sizeBytes: number
}
export interface RumReplayEvent {
  type: string
  at: string
  data: Record<string, unknown>
}
export interface RumReplayChunk {
  id: string
  sequence: number
  events: unknown
  eventCount: number
  sizeBytes: number
  occurredAt: string
}
export interface RumReplayChunks {
  items: RumReplayChunk[]
  nextSequence: number | null
}
export interface RumSourceMap {
  id: string
  appId: string
  release: string
  artifactPath: string
  checksum: string
  sizeBytes: number
  uploadedById: string | null
  createdAt: string
  updatedAt: string
}
export type RumPerformanceMetric =
  'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB' | 'PAGE_LOAD' | 'RESOURCE' | 'HTTP'
export type RumPerformanceRating = 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR'

/** 应用概览：PV/UV/点击、请求健康度、错误与事件，以及对应的时间序列。 */
export interface RumAppOverviewTraffic {
  pv: number
  uv: number
  clicks: number
}
export interface RumAppOverviewRequests {
  total: number
  success: number
  failures: number
  successRate: number | null
  errorRate: number | null
  p75: number | null
  average: number | null
}
export interface RumAppOverviewErrors {
  js: number
  custom: number
  total: number
  events: number
  jsRate: number | null
}
export interface RumAppOverviewPoint {
  bucketStart: string
  pv: number
  uv: number
  clicks: number
  requests: number
  failures: number
  jsErrors: number
  customErrors: number
  events: number
}
export interface RumAppOverview {
  from: string
  to: string
  bucketMinutes: number
  traffic: RumAppOverviewTraffic
  requests: RumAppOverviewRequests
  errors: RumAppOverviewErrors
  series: RumAppOverviewPoint[]
}

/** 错误列表页顶部概览：错误发生次数、错误率与按桶的分布。 */
export interface RumErrorOverviewTotals {
  errors: number
  js: number
  custom: number
  pv: number
  errorRate: number | null
  affectedUsers: number
  affectedPages: number
  openGroups: number
}
export interface RumErrorOverviewPoint {
  bucketStart: string
  errors: number
  js: number
  custom: number
  pv: number
  errorRate: number | null
}
export interface RumErrorOverview {
  from: string
  to: string
  bucketMinutes: number
  totals: RumErrorOverviewTotals
  series: RumErrorOverviewPoint[]
}
export interface RumPerformanceStats {
  metric: RumPerformanceMetric
  count: number
  average: number | null
  p75: number | null
  good: number
  needsImprovement: number
  poor: number
  failures: number
}
export interface RumPerformanceSeriesItem {
  metric: RumPerformanceMetric
  points: { bucketStart: string; count: number; average: number | null; p75: number | null }[]
  current: RumPerformanceStats & {
    rating: RumPerformanceRating | null
    changePercent: number | null
  }
  previous: RumPerformanceStats
}
export interface RumPerformanceSeries {
  from: string
  to: string
  series: RumPerformanceSeriesItem[]
}
export interface RumPerformanceSummary {
  from: string
  to: string
  metrics: Array<
    RumPerformanceStats & {
      rating: RumPerformanceRating | null
      goodRate: number | null
      poorRate: number | null
    }
  >
}
export interface RumPerformancePageItem {
  page: string
  samples: number
  p75: number | null
  errors: number
  /** Error occurrences per 100 PAGE_LOAD samples; this may exceed 100. */
  errorRate: number | null
}
export interface RumPerformancePages {
  from: string
  to: string
  items: RumPerformancePageItem[]
}
export interface RumPerformanceResourceItem {
  dimension: string
  samples: number
  p75: number | null
  failures: number
  failureRate: number | null
}
export interface RumPerformanceResources {
  from: string
  to: string
  items: RumPerformanceResourceItem[]
}
export interface RumReleaseSummary {
  release: string | null
  isUnknown: boolean
  firstSeenAt: string | null
  lastSeenAt: string | null
  errorGroups: number
  occurrences: number
  events: number
  replays: number
}
export interface RumReleaseList {
  items: RumReleaseSummary[]
  total: number
}
export interface RumReleaseGroup {
  id: string
  type: string
  category: string | null
  level: string | null
  message: string
  page: string | null
  release: string | null
  status: RumErrorStatus
  count: number
  firstSeenAt: string
  lastSeenAt: string
}
export interface RumReleaseCompare {
  base: { release: string | null; isUnknown: boolean }
  target: { release: string | null; isUnknown: boolean }
  baseStartedAt: string | null
  new: RumReleaseGroup[]
  fixed: RumReleaseGroup[]
  regressed: RumReleaseGroup[]
  counts: { new: number; fixed: number; regressed: number }
}
export type RumAlertMetric = 'ERROR_COUNT' | 'EVENT_COUNT' | 'NEW_ERROR' | 'ERROR_RATE' | 'SPIKE'
export type RumAlertScope = 'APP' | 'ERROR_GROUP'
export interface RumAlertRule {
  id: string
  name: string
  metric: RumAlertMetric
  scope: RumAlertScope
  groupId: string | null
  eventName: string | null
  threshold: number
  windowMinutes: number
  confirmWindows: number
  consecutiveHits: number
  silenceUntil: string | null
  channelIds: string[]
  enabled: boolean
  active: boolean
  lastValue: number
  lastEvaluatedAt: string | null
}
export interface RumAlertInput {
  name: string
  metric: RumAlertMetric
  scope?: RumAlertScope
  groupId?: string
  eventName?: string
  threshold: number
  windowMinutes: number
  confirmWindows?: number
  silenceUntil?: string | null
  channelIds: string[]
  enabled: boolean
}
export interface RumAlertIncident {
  id: string
  ruleId: string
  status: 'OPEN' | 'RESOLVED'
  value: number
  threshold: number
  startedAt: string
  resolvedAt: string | null
  rule?: {
    id: string
    name: string
    metric: RumAlertMetric
    eventName: string | null
    windowMinutes: number
  }
}

/** Minimal channel information available to an app manager. */
export interface RumAlertChannel {
  id: string
  name: string
  enabled: boolean
}

export interface RumProjectOverview {
  appCount: number
  errorGroups: number
  events7d: number
  replays: number
  openAlerts: number
  apps: { id: string; name: string; enabled: boolean; errorGroups: number; events7d: number }[]
}
export type RumProjectError = RumErrorGroup & { appId: string; app: { id: string; name: string } }
export type RumProjectEvent = RumEvent & { appId: string; app: { id: string; name: string } }
