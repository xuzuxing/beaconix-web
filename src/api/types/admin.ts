// ============================================================
// 管理后台域（仅 SUPER_ADMIN）
// 对齐后端 AdminMetricsController / AdminTenantsController / SystemProbesController /
// AdminAuditLogsController / AdminOrdersController 的返回结构。
// ============================================================

import type { Order, OrderStatus } from './billing'
import type { AuditLog, AuditLogQuery } from './team'

// ------------------------------------------------------------
// 平台指标（GET /admin/metrics/*）
// ------------------------------------------------------------

export interface AdminTenantCounts {
  total: number
  active: number
  deleted: number
}

export interface AdminMonitorCounts {
  total: number
  enabled: number
}

export interface AdminProbeCounts {
  total: number
  tenant: number
  system: number
}

/** 平台整体用量（GET /admin/metrics/overview） */
export interface AdminMetricsOverview {
  tenants: AdminTenantCounts
  users: number
  projects: number
  monitors: AdminMonitorCounts
  probes: AdminProbeCounts
  checkVolume: number
  notificationVolume: number
  statusPages: number
  /** 已被系统探针承接的租户数 */
  systemProbeUsage: number
}

/** 单个队列的积压情况 */
export interface AdminSchedulerQueue {
  waiting: number
  active: number
  delayed: number
  failed: number
  completed: number
}

/** 已注册的定时任务：间隔型（everyMs）或 cron 型（pattern）二选一 */
export interface AdminSchedulerJob {
  id: string
  everyMs: number | null
  pattern: string | null
  nextRunAt: string | null
}

/** 待检测积压 */
export interface AdminSchedulerBacklog {
  enabledMonitors: number
  dueMonitors: number
}

/** 探针在线情况 */
export interface AdminSchedulerProbeCounts {
  online: number
  offline: number
}

/** 调度器与队列健康度（GET /admin/metrics/scheduler） */
export interface AdminSchedulerHealth {
  scanQueue: AdminSchedulerQueue
  checkQueue: AdminSchedulerQueue
  scheduledQueue: AdminSchedulerQueue
  schedulers: AdminSchedulerJob[]
  backlog: AdminSchedulerBacklog
  probes: AdminSchedulerProbeCounts
}

/** 单租户用量行（GET /admin/metrics/tenants） */
export interface AdminTenantMetric {
  organizationId: string
  name: string
  slug: string
  active: boolean
  monitorCount: number
  enabledMonitorCount: number
  tenantProbeCount: number
  systemProbeUsage: number
  checkVolume: number
  notificationVolume: number
  statusPageCount: number
}

// ------------------------------------------------------------
// 租户（GET /admin/tenants）
// ------------------------------------------------------------

/** 跨租户视角的组织：`active` 为假表示已被平台软删除 */
export interface AdminTenant {
  id: string
  name: string
  slug: string
  ownerId: string
  active: boolean
  memberCount: number
  projectCount: number
  monitorCount: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// ------------------------------------------------------------
// 系统探针（GET /admin/system-probes）
// ------------------------------------------------------------

export type ProbeProvider = 'TENCENT' | 'ALIYUN' | 'CUSTOM'
export type ProbeScope = 'SYSTEM' | 'TENANT'
export type ProbeStatus = 'ONLINE' | 'OFFLINE'

/** 系统探针承接的监控项摘要 */
export interface ProbeMonitor {
  id: string
  name: string
  type: 'HTTP' | 'TCP'
  target: string
  enabled: boolean
}

/** 系统探针 */
export interface SystemProbe {
  id: string
  organizationId?: string | null
  scope: ProbeScope
  name: string
  provider: ProbeProvider
  region: string
  callbackUrl: string
  /** 共享密钥，仅创建响应返回一次，后续读取不带该字段 */
  secret?: string
  enabled: boolean
  lastHeartbeat: string | null
  /** 探针上报的心跳间隔（秒），离线阈值取其 3 倍 */
  heartbeatIntervalSeconds: number | null
  status: ProbeStatus
  /** 单个系统探针最多承接的租户数 */
  maxTenants: number | null
  /** 调度优先级，越大越优先 */
  priority: number
  createdAt: string
  updatedAt: string
  monitors: ProbeMonitor[]
  /** 已存储的探测结果条数 */
  resultCount?: number
}

export interface CreateSystemProbeParams {
  name: string
  provider: ProbeProvider
  region: string
  callbackUrl: string
  enabled?: boolean
  maxTenants?: number
  priority?: number
}

export type UpdateSystemProbeParams = Partial<CreateSystemProbeParams>

/** 联通校验挑战（POST /admin/system-probes/{id}/validate） */
export interface ProbeValidationChallenge {
  validationId: string
  expiresAt: string
  status: string
}

/** 重平衡结果：探针 ID → 承接的租户 ID 列表 */
export type SystemProbeAssignments = Record<string, string[]>

// ------------------------------------------------------------
// 跨租户审计日志（GET /admin/audit-logs）
// ------------------------------------------------------------

/** 比组织内查询多一个 organizationId 维度，其余字段沿用团队审计日志 */
export interface AdminAuditLogQuery extends AuditLogQuery {
  organizationId?: string
}

export type { AuditLog }

/** 与团队审计日志一致：items / total / page / limit / totalPages */
export interface AdminAuditLogPage {
  items: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ------------------------------------------------------------
// 跨租户订单（GET /admin/orders）
// ------------------------------------------------------------

/** 订单所属租户（列表内嵌，避免额外查询） */
export interface AdminOrderOrganization {
  id: string
  name: string
  slug: string
}

/** 下单人（列表内嵌） */
export interface AdminOrderUser {
  id: string
  name: string
  email: string
}

/** 与组织维度订单同构，额外内嵌租户与下单人 */
export interface AdminOrder extends Order {
  organization?: AdminOrderOrganization | null
  user?: AdminOrderUser | null
}

/** 订单查询参数（全部可选，未传即不按该维度过滤） */
export interface AdminOrderQuery {
  organizationId?: string
  userId?: string
  planId?: string
  status?: OrderStatus
  orderNo?: string
  /** 起始时间（ISO 8601） */
  from?: string
  /** 结束时间（ISO 8601） */
  to?: string
  page?: number
  limit?: number
}

/** 与审计日志相同的分页包装：items / total / page / limit / totalPages */
export interface AdminOrderPage {
  items: AdminOrder[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ------------------------------------------------------------
// 平台运行时配置（GET /admin/settings）
// ------------------------------------------------------------

/** 配置项的值类型，决定管理页用哪个控件编辑 */
export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'

/** 配置项的值：标量、数组或对象 */
export type SettingValue =
  string | number | boolean | null | SettingValue[] | { [key: string]: SettingValue }

/**
 * 平台运行时配置项。
 *
 * `group` 由后端显式返回，管理页据此把配置项放进对应 tab；
 * tab 的清单与顺序来自 `develop.configGroup` 这一项的值（字符串数组，可任意增删）。
 * `section` 是 tab 内的二级分组（同样是稳定的英文标识），用于把项数多的 tab
 * 切成若干块；未声明时该项直接挂在 tab 顶层。
 */
export interface AdminSetting {
  key: string
  name: string
  /** 所属分组，例如 storage / monitor，与 tab 一一对应 */
  group: string
  /** tab 内的二级分组标识，例如微信 tab 里的 pay / scanLogin；缺省表示不分组 */
  section?: string
  value: SettingValue
  valueType: SettingValueType
  description: string | null
  /** 密文项：后端不回显值，只允许整值覆盖写入 */
  isSecret: boolean
  /** 值与后端内置默认一致，即尚未被平台覆盖过 */
  isDefault: boolean
  /** 最后一次写入者，从未覆盖过时为 null */
  updatedById: string | null
  createdAt: string | null
  updatedAt: string | null
  /** 后端给了候选项就渲染下拉，不给则是普通输入框 */
  options?: SettingOption[]
  /** 数值项的取值范围，用于前端提示 */
  min?: number
  max?: number
}

/** 配置项的候选项 */
export interface SettingOption {
  label: string
  labelEn?: string
  value: string | number
}

/** 写入配置项（PATCH /admin/settings/{key}）：值必填，其余字段由后端维护 */
export interface UpdateAdminSettingParams {
  value: SettingValue
}
