import type {
  AdminOrder,
  AdminSchedulerHealth,
  AdminSchedulerJob,
  AdminSchedulerQueue,
  AdminTenant,
  ProbeProvider,
  ProbeStatus,
  SystemProbe,
} from '@/api/types/admin'
import type { OrderStatus } from '@/api/types/billing'

/**
 * 管理后台页面的展现层纯函数：探针存活、租户筛选、订单可执行动作、调度健康度与数值压缩。
 * 只做数据整形，不发请求，便于单元测试（test/admin-presenter.test.mjs）。
 */

// ============================================================
// 系统探针
// ============================================================

export const PROBE_PROVIDERS: ProbeProvider[] = ['TENCENT', 'ALIYUN', 'CUSTOM']

/** 供应商标签主题 */
export function probeProviderTheme(provider: ProbeProvider): 'primary' | 'warning' | 'default' {
  switch (provider) {
    case 'TENCENT':
      return 'primary'
    case 'ALIYUN':
      return 'warning'
    default:
      return 'default'
  }
}

/** 供应商 → i18n key（adminPage.probe.providerLabel.TENCENT …，与文案文件同名） */
export function probeProviderLabelKey(provider: ProbeProvider): string {
  return `adminPage.probe.providerLabel.${provider}`
}

/** 后端上报的在线状态对应的标签主题 */
export function probeStatusTheme(status: ProbeStatus): 'success' | 'danger' {
  return status === 'ONLINE' ? 'success' : 'danger'
}

/** 心跳间隔缺失时的兜底值（秒） */
const DEFAULT_HEARTBEAT_SECONDS = 60

/**
 * 离线阈值：心跳间隔的 3 倍（与后端同口径）。
 * 探针还没上报过心跳时按兜底间隔计算。
 */
export function probeOfflineThresholdMs(
  probe: Pick<SystemProbe, 'heartbeatIntervalSeconds'>,
): number {
  const seconds = probe.heartbeatIntervalSeconds
  const base = typeof seconds === 'number' && seconds > 0 ? seconds : DEFAULT_HEARTBEAT_SECONDS
  return base * 3 * 1000
}

/** 最近一次心跳是否已经超时（后端的 status 字段可能滞后于心跳） */
export function isProbeHeartbeatStale(probe: SystemProbe, now = Date.now()): boolean {
  if (!probe.lastHeartbeat) return true
  const beat = Date.parse(probe.lastHeartbeat)
  if (!Number.isFinite(beat)) return true
  return now - beat > probeOfflineThresholdMs(probe)
}

/** 列表展示的存活状态：后端标记 ONLINE 但心跳过期时降级为 stale */
export type ProbeLiveness = 'online' | 'stale' | 'offline'

export function probeLiveness(probe: SystemProbe, now = Date.now()): ProbeLiveness {
  if (probe.status !== 'ONLINE') return 'offline'
  return isProbeHeartbeatStale(probe, now) ? 'stale' : 'online'
}

export function probeLivenessTheme(liveness: ProbeLiveness): 'success' | 'warning' | 'danger' {
  if (liveness === 'online') return 'success'
  return liveness === 'stale' ? 'warning' : 'danger'
}

/** 探针是否匹配关键词（名称 / 区域 / 回调地址 / ID） */
export function probeMatches(probe: SystemProbe, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  return [probe.name, probe.region, probe.callbackUrl, probe.id]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(kw))
}

/** 按关键词筛选探针，保持后端给出的顺序 */
export function selectSystemProbes(probes: readonly SystemProbe[], keyword: string): SystemProbe[] {
  return probes.filter((probe) => probeMatches(probe, keyword))
}

/** 探针承接的监控项数量（列表接口可能不带 monitors） */
export function probeMonitorCount(probe: Pick<SystemProbe, 'monitors'>): number {
  return probe.monitors?.length ?? 0
}

// ============================================================
// 租户
// ============================================================

export type AdminTenantState = 'all' | 'active' | 'deleted'

/** 租户状态：active 为假即平台软删除 */
export function adminTenantState(tenant: Pick<AdminTenant, 'active'>): 'active' | 'deleted' {
  return tenant.active ? 'active' : 'deleted'
}

export function adminTenantTheme(state: 'active' | 'deleted'): 'success' | 'default' {
  return state === 'active' ? 'success' : 'default'
}

/** 租户是否匹配关键词（名称 / slug / 所有者 / ID） */
export function adminTenantMatches(tenant: AdminTenant, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  return [tenant.name, tenant.slug, tenant.ownerId, tenant.id]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(kw))
}

/**
 * 租户列表筛选：关键词 + 状态，活跃的排在前面，同级按创建时间倒序。
 */
export function selectAdminTenants(
  tenants: readonly AdminTenant[],
  keyword: string,
  state: AdminTenantState = 'all',
): AdminTenant[] {
  const rank = (tenant: AdminTenant) => (tenant.active ? 0 : 1)
  return tenants
    .filter((tenant) => (state === 'all' ? true : adminTenantState(tenant) === state))
    .filter((tenant) => adminTenantMatches(tenant, keyword))
    .slice()
    .sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt))
}

// ============================================================
// 订单
// ============================================================

export const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']

/** 订单状态对应的标签主题 */
export function orderStatusTheme(status: OrderStatus): 'success' | 'warning' | 'default' {
  switch (status) {
    case 'PAID':
      return 'success'
    case 'PENDING':
      return 'warning'
    default:
      return 'default'
  }
}

/** 待支付订单是否已过期（后端创建后 30 分钟失效） */
export function isOrderExpired(order: Pick<AdminOrder, 'expiresAt'>, now = Date.now()): boolean {
  const expires = Date.parse(order.expiresAt)
  return Number.isFinite(expires) && expires <= now
}

/** 平台订单可执行的运营操作，与后端状态机一一对应 */
export interface OrderActions {
  /** PENDING → CANCELLED */
  canCancel: boolean
  /** PENDING → PAID（人工补单） */
  canMarkPaid: boolean
  /** PAID → REFUNDED */
  canRefund: boolean
}

export function orderActions(order: Pick<AdminOrder, 'status'>): OrderActions {
  const pending = order.status === 'PENDING'
  return {
    canCancel: pending,
    canMarkPaid: pending,
    canRefund: order.status === 'PAID',
  }
}

// ============================================================
// 平台指标 / 调度健康度
// ============================================================

/** 大数字压缩展示：1234 → 1.2K，180000 → 180K，1200000 → 1.2M */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs < 1000) return String(value)
  const units = [
    { limit: 1_000_000_000, suffix: 'B' },
    { limit: 1_000_000, suffix: 'M' },
    { limit: 1_000, suffix: 'K' },
  ]
  for (const { limit, suffix } of units) {
    if (abs >= limit) return `${Number((value / limit).toFixed(1))}${suffix}`
  }
  return String(value)
}

/** 队列积压：等待 + 处理中 + 延迟 */
export function queueBacklog(queue: AdminSchedulerQueue): number {
  return queue.waiting + queue.active + queue.delayed
}

export type HealthLevel = 'ok' | 'warning' | 'danger'

export function healthLevelTheme(level: HealthLevel): 'success' | 'warning' | 'danger' {
  if (level === 'ok') return 'success'
  return level === 'warning' ? 'warning' : 'danger'
}

/**
 * 调度健康度：
 * - danger：有失败任务，或存在到期未检测的监控项积压
 * - warning：有探针离线
 * - ok：其余情况
 */
export function schedulerHealthLevel(health: AdminSchedulerHealth): HealthLevel {
  const queues = [health.scanQueue, health.checkQueue, health.scheduledQueue]
  if (queues.some((queue) => queue.failed > 0)) return 'danger'
  if (health.backlog.dueMonitors > 0) return 'danger'
  if (health.probes.offline > 0) return 'warning'
  return 'ok'
}

/** 定时任务的触发方式：间隔型与 cron 型二选一 */
export type JobSchedule =
  | { kind: 'interval'; ms: number }
  | { kind: 'cron'; pattern: string }
  | { kind: 'unknown' }

export function jobSchedule(job: AdminSchedulerJob): JobSchedule {
  if (typeof job.everyMs === 'number' && job.everyMs > 0) {
    return { kind: 'interval', ms: job.everyMs }
  }
  if (job.pattern) return { kind: 'cron', pattern: job.pattern }
  return { kind: 'unknown' }
}

/** 间隔毫秒 → 人类可读的秒 / 分 / 时 */
export function formatInterval(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`
  if (ms % 60_000 === 0) return `${ms / 60_000}m`
  if (ms % 1000 === 0) return `${ms / 1000}s`
  return `${(ms / 1000).toFixed(1)}s`
}
