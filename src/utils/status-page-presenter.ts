import type { MonitorStatus } from '../api/types'
import type { PublicStatusPageMonitor, StatusPage } from '../api/types/status-page'
import { monitorStatusTheme } from './monitor-presenter'

// ============================================================
// 展示模板（前端预设，不入库）
// ============================================================

export type StatusPageTemplateId = 'standard' | 'minimal' | 'performance'

/**
 * 页面模板 = 一组公开页展示开关的预设。
 * 后端暂无 status-page-templates 资源（见 docs/menu-structure.md），
 * 因此模板只作为「新建状态页」的初值，不落库、不影响已创建的状态页。
 */
export interface StatusPageTemplate {
  id: StatusPageTemplateId
  showLatency: boolean
  showUptime: boolean
  /** 是否在模板列表上标注为推荐 */
  recommended: boolean
}

/** 模板顺序即模板页的展示顺序 */
export const STATUS_PAGE_TEMPLATES: StatusPageTemplate[] = [
  { id: 'standard', showLatency: false, showUptime: true, recommended: true },
  { id: 'minimal', showLatency: false, showUptime: false, recommended: false },
  { id: 'performance', showLatency: true, showUptime: true, recommended: false },
]

export function findStatusPageTemplate(id: unknown): StatusPageTemplate | undefined {
  return STATUS_PAGE_TEMPLATES.find((template) => template.id === id)
}

/** 模板带来的展示字段（用于卡片上的标签） */
export function templateVisibilityFields(template: StatusPageTemplate) {
  return statusPageVisibilityFields(template)
}

// ============================================================
// slug / 公开地址
// ============================================================

/** 公开地址标识：小写字母、数字与连字符，不能以连字符开头或结尾 */
export const STATUS_PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidStatusPageSlug(value: string) {
  return STATUS_PAGE_SLUG_PATTERN.test(value)
}

/**
 * 由标题推导 slug，作为输入框里的建议值。
 * 后端在 slug 留空时也会自行生成，前端只保证提交的取值合法。
 */
export function slugifyStatusPageTitle(title: string) {
  return title
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/** 应用内公开页路径（路由 `/status/:slug`） */
export function publicStatusPagePath(slug: string) {
  return `/status/${encodeURIComponent(slug)}`
}

/** 公开页绝对地址：用于复制分享（考虑部署在子路径的情况） */
export function publicStatusPageUrl(slug: string) {
  const base = import.meta.env.BASE_URL || '/'
  const path = `status/${encodeURIComponent(slug)}`
  return new URL(`${base.replace(/\/?$/, '/')}${path}`, window.location.origin).href
}

// ============================================================
// 筛选 / 排序 / 统计
// ============================================================

export type StatusPageStatusFilter = 'all' | 'enabled' | 'disabled'
export type StatusPageSort = 'newest' | 'name' | 'monitors'

export function selectStatusPages(
  rows: StatusPage[],
  search: string,
  status: StatusPageStatusFilter,
  sort: StatusPageSort,
) {
  const query = search.trim().toLocaleLowerCase()
  return rows
    .filter(
      (row) =>
        (!query ||
          `${row.title} ${row.slug} ${row.description ?? ''}`.toLocaleLowerCase().includes(query)) &&
        (status === 'all' || row.enabled === (status === 'enabled')),
    )
    .sort((a, b) => {
      const order =
        sort === 'name'
          ? a.title.localeCompare(b.title)
          : sort === 'monitors'
            ? b.visibleMonitorIds.length - a.visibleMonitorIds.length ||
              a.title.localeCompare(b.title)
            : Date.parse(b.createdAt) - Date.parse(a.createdAt)
      return order || a.id.localeCompare(b.id)
    })
}

/** 概览统计：总数 / 启用 / 停用 / 覆盖监控项 / 展示开关数量 */
export function summarizeStatusPages(rows: StatusPage[]) {
  let enabled = 0
  let showLatency = 0
  let showUptime = 0
  const monitorIds = new Set<string>()
  rows.forEach((row) => {
    if (row.enabled) enabled++
    if (row.showLatency) showLatency++
    if (row.showUptime) showUptime++
    row.visibleMonitorIds.forEach((id) => monitorIds.add(id))
  })
  return {
    total: rows.length,
    enabled,
    disabled: rows.length - enabled,
    monitors: monitorIds.size,
    showLatency,
    showUptime,
  }
}

/** 状态页行上的展示字段标签 */
export function statusPageVisibilityFields(page: Pick<StatusPage, 'showLatency' | 'showUptime'>) {
  return [
    ...(page.showUptime ? (['uptime'] as const) : []),
    ...(page.showLatency ? (['latency'] as const) : []),
  ]
}

/** 可见监控项数量（公开页从后端拿列表，列表页只有 id） */
export function statusPageMonitorCount(page: Pick<StatusPage, 'visibleMonitorIds'>) {
  return page.visibleMonitorIds.length
}

// ============================================================
// 公开页数值展示
// ============================================================

/** 延迟展示：毫秒，缺失时返回 null 由调用方回退 */
export function formatLatency(latency: number | null | undefined) {
  if (typeof latency !== 'number' || !Number.isFinite(latency)) return null
  return `${Math.round(latency)} ms`
}

/** 可用率展示：保留两位小数（后端返回的已是百分比） */
export function formatUptime(percent: number | null | undefined) {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return null
  return `${percent.toFixed(2)}%`
}

// ============================================================
// 公开页图表数据
// ============================================================

/** 监控项状态计数：公开页环形图的数据源（键即 MonitorStatus 全集） */
export function summarizePublicMonitors(monitors: PublicStatusPageMonitor[]) {
  const counts: Record<MonitorStatus, number> = {
    UP: 0,
    DEGRADED: 0,
    DOWN: 0,
    PAUSED: 0,
    UNKNOWN: 0,
  }
  monitors.forEach((monitor) => {
    counts[monitor.status] = (counts[monitor.status] ?? 0) + 1
  })
  return counts
}

/** 延迟条形的归一基准：所有监控项里的最大延迟（无数据时为 0） */
export function maxMonitorLatency(monitors: Pick<PublicStatusPageMonitor, 'latency'>[]) {
  return monitors.reduce((max, monitor) => {
    const value = monitor.latency
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)
}

/** 可用率条比例（0-1），缺失或越界时收窄到 [0, 1] */
export function uptimeRatio(percent: number | null | undefined) {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 0
  return Math.min(1, Math.max(0, percent / 100))
}

/** 延迟条比例（0-1）：相对最大延迟归一，基准为 0 时返回 0 */
export function latencyRatio(latency: number | null | undefined, max: number) {
  if (typeof latency !== 'number' || !Number.isFinite(latency) || max <= 0) return 0
  return Math.min(1, Math.max(0, latency / max))
}

/** 语义色调：环形图与行内迷你条共用（沿用监控状态标签的主题映射） */
export type StatusPageStatusTone = 'success' | 'warning' | 'danger' | 'neutral'

export function monitorStatusTone(status: MonitorStatus): StatusPageStatusTone {
  const tagTheme = monitorStatusTheme[status]
  return tagTheme === 'default' ? 'neutral' : tagTheme
}
