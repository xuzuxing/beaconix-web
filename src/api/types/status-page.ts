import type { MonitorStatus, MonitorType } from '../types'

// ============================================================
// 状态页
// ============================================================

/**
 * 状态页（组织级资源）。
 * 公开地址为 `/status/{slug}`，只展示 `visibleMonitorIds` 里的监控项。
 */
export interface StatusPage {
  id: string
  organizationId: string
  /** 公开地址标识，组织内唯一 */
  slug: string
  title: string
  description: string | null
  /** 在公开页展示的监控项（必须属于本组织） */
  visibleMonitorIds: string[]
  /** 公开页是否展示延迟 */
  showLatency: boolean
  /** 公开页是否展示可用率 */
  showUptime: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateStatusPageParams {
  title: string
  /** 留空时由后端按标题生成 */
  slug?: string
  description?: string
  visibleMonitorIds?: string[]
  showLatency?: boolean
  showUptime?: boolean
  enabled?: boolean
}

export type UpdateStatusPageParams = Partial<CreateStatusPageParams>

/** 公开页里的监控条目（latency / uptimePercent 取决于页面的展示开关） */
export interface PublicStatusPageMonitor {
  id: string
  name: string
  type: MonitorType
  target: string
  status: MonitorStatus
  lastCheckAt?: string | null
  latency?: number | null
  uptimePercent?: number | null
}

/** 公开状态页（GET /status/{slug}，无需鉴权） */
export interface PublicStatusPage {
  slug: string
  title: string
  description: string | null
  /** 页面整体状态：由可见监控项汇总而来 */
  overallStatus: MonitorStatus
  showLatency: boolean
  showUptime: boolean
  monitors: PublicStatusPageMonitor[]
  updatedAt: string
}
