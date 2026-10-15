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

/**
 * 单个监控项的逐小时可用率（公开页热力图用）。
 *
 * 字段与概览页的 `MonitoringAvailabilityEntity` 对齐，只保留绘制热力图必需的几项；
 * 后端尚未在公开接口里提供这个数据组，因此 `PublicStatusPageMonitor.availability`
 * 是可选字段：缺失时前端整块不渲染。
 */
export interface PublicMonitorAvailability {
  /** Y 轴：日期标签（如 03-05），最新一天在末尾 */
  days: string[]
  /** X 轴：小时序号 0-23 */
  hours: number[]
  /** [小时索引, 天索引, 可用率百分比] */
  cells: [number, number, number][]
  /** 没有检测数据的小时位置 [小时索引, 天索引]，渲染为灰色格 */
  unavailableCells?: [number, number][]
  /** 最低可用率所在位置，用于卡片右上角说明 */
  worst?: { day: string; hour: number; value: number } | null
  /** 仅前端演示数据会置 true（后端不返回该字段），用于在卡片上标注「演示数据」 */
  simulated?: boolean
}

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
  /**
   * 逐小时可用率（近 3 天）。后端补上该数据组后热力图自动生效；
   * 未返回时不渲染，页面其余部分不受影响。
   */
  availability?: PublicMonitorAvailability
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
  /**
   * 品牌 logo 地址（状态页可配置项）。
   * 后端暂未提供，为空或加载失败时前端回退到 Beacon 默认品牌 logo（随明暗主题切换）。
   */
  logoUrl?: string | null
  /**
   * 页脚版权文案（状态页可配置项）。
   * 后端暂未提供，为空时前端回退到默认版权文案。
   */
  footerText?: string | null
}
