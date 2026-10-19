import dayjs from 'dayjs'

/**
 * 监控概览页的模拟数据。
 *
 * 数据全部在前端按"真实监控系统会有的指标"生成（时序为确定性伪随机，
 * 刷新页面结果稳定），接入后端接口后把这里的取值换成请求结果即可，
 * 页面与图表无需改动。
 */

/** 时间范围 */
export type MonitorRange = '1h' | 'today' | '7d' | '30d'

/** 时间范围选项，用于概览页头部的范围切换 */
export const RANGE_OPTIONS: { value: MonitorRange; labelKey: string }[] = [
  { value: '1h', labelKey: 'dashboard.range.h1' },
  { value: 'today', labelKey: 'dashboard.range.today' },
  { value: '7d', labelKey: 'dashboard.range.d7' },
  { value: '30d', labelKey: 'dashboard.range.d30' },
]

/** 各范围的采样点数与采样间隔（分钟） */
const RANGE_PRESETS: Record<
  Exclude<MonitorRange, 'today'>,
  { points: number; stepMinutes: number }
> = {
  '1h': { points: 30, stepMinutes: 2 },
  '7d': { points: 28, stepMinutes: 360 },
  '30d': { points: 30, stepMinutes: 1440 },
}

/** 「今天」按整点采样，点数随当前时间增长（至少 4 个点，保证图表可读） */
function resolvePreset(range: MonitorRange): {
  points: number
  stepMinutes: number
} {
  if (range === 'today') {
    return { points: Math.max(dayjs().hour() + 1, 4), stepMinutes: 60 }
  }
  return RANGE_PRESETS[range]
}

/** 生成确定性伪随机序列：同一 seed 每次得到同样的数据，便于对比与截图 */
function createRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** 概览时序：各指标同长度，索引一一对应 labels */
export interface MonitorTimeline {
  /** X 轴时间标签 */
  labels: string[]
  /** 每分钟检查次数（监控项数 × 检查频率） */
  checks: number[]
  /** 该采样点的失败检查次数 */
  failures: number[]
  /** 响应时间分位（毫秒） */
  latencyP50: number[]
  latencyP95: number[]
  latencyP99: number[]
  /** 可用率（%） */
  availability: number[]
}

function formatLabel(time: dayjs.Dayjs, range: MonitorRange): string {
  if (range === '7d') {
    return time.format('MM-DD HH:mm')
  }
  if (range === '30d') {
    return time.format('MM-DD')
  }
  return time.format('HH:mm')
}

/** 按时间范围生成概览时序（确定性） */
export function buildMonitorTimeline(range: MonitorRange): MonitorTimeline {
  const { points, stepMinutes } = resolvePreset(range)
  const end = dayjs()
  // 「今天」从 00:00 起算，其余范围从当前时刻往前推
  const start =
    range === 'today' ? end.startOf('day') : end.subtract((points - 1) * stepMinutes, 'minute')
  const rand = createRandom(points * 7919 + stepMinutes)
  // 事故窗口：范围越短越可能落在窗口内，用来演示可用率凹坑与错误尖峰
  const incidentIndex = Math.floor(points * 0.62)

  const timeline: MonitorTimeline = {
    labels: [],
    checks: [],
    failures: [],
    latencyP50: [],
    latencyP95: [],
    latencyP99: [],
    availability: [],
  }

  // 检查频率：项目下 48 个监控项，多数为 1 分钟间隔，少数为 5 分钟
  const monitorsPerMinute = monitorSummary.total - 4

  for (let position = 0; position < points; position += 1) {
    const time = start.add(position * stepMinutes, 'minute')
    // 日周期：白天检查更密集，深夜部分监控降频
    const phase = ((time.hour() + time.minute() / 60) / 24) * Math.PI * 2
    const daily = 0.82 + 0.18 * Math.sin(phase - Math.PI / 2)
    // 7 天 / 30 天再叠加一层低频波动，避免曲线只剩噪声
    const longWave = 1 + 0.07 * Math.sin((position / Math.max(points - 1, 1)) * Math.PI * 3)
    const noise = rand()

    const checks = Math.round(monitorsPerMinute * daily * longWave * (0.94 + noise * 0.12))
    const latencyP50 = Math.round(78 + (1 - daily) * 46 + noise * 22)
    const latencyP95 = Math.round(latencyP50 * (1.85 + noise * 0.35))
    const latencyP99 = Math.round(latencyP95 * (1.22 + noise * 0.22))
    const inIncident = position >= incidentIndex && position < incidentIndex + 3
    // 失败检查很少：事故窗口内 1~2 个监控项连续失败，其余时间基本为 0
    const failures = inIncident ? Math.round(1 + noise * 2) : noise < 0.9 ? 0 : 1
    const availability = inIncident
      ? Number((97.4 + noise * 0.9).toFixed(2))
      : Number((99.94 + noise * 0.05).toFixed(2))

    timeline.labels.push(formatLabel(time, range))
    timeline.checks.push(checks)
    timeline.failures.push(failures)
    timeline.latencyP50.push(latencyP50)
    timeline.latencyP95.push(latencyP95)
    timeline.latencyP99.push(latencyP99)
    timeline.availability.push(availability)
  }

  return timeline
}

/** 概览 KPI 卡片 */
export interface MonitorKpi {
  key: string
  /** 指标名的 i18n key */
  labelKey: string
  /** 展示值（已格式化） */
  value: string
  /** 单位的 i18n key */
  unitKey?: string
  /** 环比变化值与说明 */
  deltaText: string
  /** 变化方向是否为好（决定颜色） */
  good: boolean
  tone: 'brand' | 'success' | 'warning' | 'error'
  /** 迷你趋势 */
  trend: number[]
  tipKey?: string
}

/** 监控项与探针的当前规模（模拟） */
export const monitorSummary = {
  total: 48,
  up: 44,
  down: 2,
  degraded: 1,
  paused: 1,
  alerting: 3,
  sslExpiring: 2,
  probes: { total: 12, online: 11 },
}

/** 由时序派生 KPI 卡片 */
export function buildMonitorKpis(timeline: MonitorTimeline): MonitorKpi[] {
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length

  const availability = average(timeline.availability.slice(0, -1))
  const failingRate =
    (timeline.failures.reduce((sum, value) => sum + value, 0) /
      Math.max(
        timeline.checks.reduce((sum, value) => sum + value, 0),
        1,
      )) *
    100
  const p95 = Math.round(average(timeline.latencyP95))

  return [
    {
      key: 'availability',
      labelKey: 'dashboard.kpi.availability',
      value: availability.toFixed(2),
      unitKey: 'dashboard.unit.percent',
      deltaText: '+0.02%',
      good: true,
      tone: 'success',
      trend: timeline.availability,
      tipKey: 'dashboard.kpi.availabilityTip',
    },
    {
      key: 'latency',
      labelKey: 'dashboard.kpi.latency',
      value: String(Math.round(average(timeline.latencyP50))),
      unitKey: 'dashboard.unit.ms',
      deltaText: '-8 ms',
      good: true,
      tone: 'brand',
      trend: timeline.latencyP50,
      tipKey: 'dashboard.kpi.latencyTip',
    },
    {
      key: 'p95',
      labelKey: 'dashboard.kpi.p95',
      value: String(p95),
      unitKey: 'dashboard.unit.ms',
      deltaText: '+14 ms',
      good: false,
      tone: 'warning',
      trend: timeline.latencyP95,
      tipKey: 'dashboard.kpi.p95Tip',
    },
    {
      key: 'failingRate',
      labelKey: 'dashboard.kpi.failingRate',
      value: failingRate.toFixed(2),
      unitKey: 'dashboard.unit.percent',
      deltaText: '+0.04%',
      good: false,
      tone: 'error',
      trend: timeline.failures,
      tipKey: 'dashboard.kpi.failingRateTip',
    },
    {
      key: 'monitors',
      labelKey: 'dashboard.kpi.monitors',
      value: String(monitorSummary.total),
      deltaText: '+3',
      good: true,
      tone: 'brand',
      trend: [42, 43, 43, 44, 45, 46, 46, 47, 47, 48, 48, 48],
      tipKey: 'dashboard.kpi.monitorsTip',
    },
    {
      key: 'failing',
      labelKey: 'dashboard.kpi.failing',
      value: String(monitorSummary.down + monitorSummary.degraded),
      deltaText: '-1',
      good: true,
      tone: 'warning',
      trend: [2, 2, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3],
      tipKey: 'dashboard.kpi.failingTip',
    },
  ]
}

/** 可用性热力图：近 30 天 × 24 小时 */
export interface AvailabilityHeatmap {
  /** X 轴：24 小时 */
  hours: number[]
  /** Y 轴：日期标签 */
  days: string[]
  /** [小时索引, 天索引, 可用率] */
  cells: [number, number, number][]
  /** 最低可用率所在位置，用于卡片右上角说明 */
  worst: { day: string; hour: number; value: number }
}

/** 生成近 30 天的可用率热力图（确定性） */
export function buildAvailabilityHeatmap(): AvailabilityHeatmap {
  const days = 30
  const rand = createRandom(20261010)
  const cells: [number, number, number][] = []
  const dayLabels: string[] = []
  const hours = Array.from({ length: 24 }, (_, hour) => hour)
  let worst = { day: '', hour: 0, value: 100 }

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = dayjs().subtract(days - 1 - dayIndex, 'day')
    const label = day.format('MM-DD')
    dayLabels.push(label)

    for (let hour = 0; hour < 24; hour += 1) {
      const noise = rand()
      // 凌晨与晚间波动更大，白天更平稳
      const unstable = hour < 7 || hour > 21
      const value = Number((99.995 - noise * (unstable ? 1.4 : 0.35)).toFixed(3))
      cells.push([hour, dayIndex, value])

      if (value < worst.value) {
        worst = { day: label, hour, value }
      }
    }
  }

  return { hours, days: dayLabels, cells, worst }
}

/** 响应时间分布直方图（最近 24 小时） */
export const responseTimeHistogram = {
  bucketsKey: [
    'dashboard.histogram.bucket.under100',
    'dashboard.histogram.bucket.100to200',
    'dashboard.histogram.bucket.200to300',
    'dashboard.histogram.bucket.300to500',
    'dashboard.histogram.bucket.500to1000',
    'dashboard.histogram.bucket.over1000',
  ],
  counts: [486230, 312870, 96340, 41260, 8640, 1290],
}

/** 监控协议分布（环形图） */
export const monitorTypeDistribution: { nameKey: string; value: number }[] = [
  { nameKey: 'dashboard.type.http', value: 26 },
  { nameKey: 'dashboard.type.tcp', value: 11 },
  { nameKey: 'dashboard.type.ping', value: 6 },
  { nameKey: 'dashboard.type.dns', value: 3 },
  { nameKey: 'dashboard.type.ssl', value: 2 },
]

/** 探针节点：名称与最近 1 小时平均延迟 */
export const probeNodes: {
  name: string
  regionKey: string
  latency: number
  online: boolean
}[] = [
  {
    name: 'probe-sh-01',
    regionKey: 'dashboard.region.shanghai',
    latency: 38,
    online: true,
  },
  {
    name: 'probe-bj-01',
    regionKey: 'dashboard.region.beijing',
    latency: 46,
    online: true,
  },
  {
    name: 'probe-gz-01',
    regionKey: 'dashboard.region.guangzhou',
    latency: 52,
    online: true,
  },
  {
    name: 'probe-cd-02',
    regionKey: 'dashboard.region.chengdu',
    latency: 74,
    online: true,
  },
  {
    name: 'probe-hk-01',
    regionKey: 'dashboard.region.hongkong',
    latency: 96,
    online: true,
  },
  {
    name: 'probe-sg-01',
    regionKey: 'dashboard.region.singapore',
    latency: 128,
    online: true,
  },
  {
    name: 'probe-fra-01',
    regionKey: 'dashboard.region.frankfurt',
    latency: 186,
    online: true,
  },
  {
    name: 'probe-sfo-01',
    regionKey: 'dashboard.region.siliconValley',
    latency: 0,
    online: false,
  },
]

/** 按小时统计的状态码分布（堆叠柱状图） */
export interface StatusCodeDistribution {
  labels: string[]
  success: number[]
  redirect: number[]
  clientError: number[]
  serverError: number[]
}

/** 最近 12 个整点的状态码分布（确定性） */
export function buildStatusCodeDistribution(): StatusCodeDistribution {
  const rand = createRandom(31415926)
  const result: StatusCodeDistribution = {
    labels: [],
    success: [],
    redirect: [],
    clientError: [],
    serverError: [],
  }

  for (let index = 11; index >= 0; index -= 1) {
    const hour = dayjs().subtract(index, 'hour')
    const noise = rand()
    const total = Math.round(22600 * (0.72 + noise * 0.5))
    const success = Math.round(total * 0.972)
    const redirect = Math.round(total * 0.019)
    const clientError = Math.round(total * 0.006)
    const serverError = Math.max(total - success - redirect - clientError, 0)

    result.labels.push(hour.format('HH:00'))
    result.success.push(success)
    result.redirect.push(redirect)
    result.clientError.push(clientError)
    result.serverError.push(serverError)
  }

  return result
}

/** 响应最慢的监控项 */
export interface SlowMonitor {
  id: string
  name: string
  target: string
  type: 'HTTP' | 'TCP' | 'PING' | 'DNS'
  /** 最近 1 小时平均响应时间（毫秒） */
  avgLatency: number
  p95: number
  /** 最近 24 小时可用率（%） */
  uptime: number
  /** 最近 24 小时趋势 */
  trend: number[]
}

export const slowestMonitors: SlowMonitor[] = [
  {
    id: 'm-1042',
    name: '订单结算接口',
    target: 'https://api.beaconix.app/v2/orders/settle',
    type: 'HTTP',
    avgLatency: 862,
    p95: 1420,
    uptime: 99.62,
    trend: [610, 640, 700, 690, 760, 820, 790, 860, 900, 880, 920, 862],
  },
  {
    id: 'm-1038',
    name: '报表导出服务',
    target: 'https://api.beaconix.app/v2/reports/export',
    type: 'HTTP',
    avgLatency: 734,
    p95: 1180,
    uptime: 99.81,
    trend: [700, 680, 720, 760, 740, 710, 760, 780, 750, 730, 745, 734],
  },
  {
    id: 'm-1015',
    name: 'MySQL 主库',
    target: 'mysql-primary.internal:3306',
    type: 'TCP',
    avgLatency: 386,
    p95: 640,
    uptime: 99.98,
    trend: [320, 340, 330, 360, 380, 375, 390, 410, 400, 395, 390, 386],
  },
  {
    id: 'm-1031',
    name: '文件上传网关',
    target: 'https://oss.beaconix.app/upload',
    type: 'HTTP',
    avgLatency: 312,
    p95: 528,
    uptime: 99.94,
    trend: [280, 290, 305, 320, 300, 315, 330, 322, 308, 300, 316, 312],
  },
  {
    id: 'm-1024',
    name: '海外 CDN 边缘节点',
    target: 'edge-sfo.beaconix.app',
    type: 'PING',
    avgLatency: 268,
    p95: 410,
    uptime: 99.71,
    trend: [240, 255, 262, 280, 272, 266, 258, 264, 270, 276, 272, 268],
  },
  {
    id: 'm-1049',
    name: 'webhook 回调（飞书）',
    target: 'https://open.feishu.cn/open-apis/bot/v2/hook',
    type: 'HTTP',
    avgLatency: 214,
    p95: 356,
    uptime: 99.88,
    trend: [205, 210, 198, 216, 224, 220, 208, 212, 218, 226, 219, 214],
  },
]

/** 告警事件级别 */
export type AlertLevel = 'critical' | 'warning' | 'recovered'

/** 最近的告警事件 */
export interface AlertEvent {
  id: string
  level: AlertLevel
  monitor: string
  target: string
  /** 事件描述（i18n key） */
  messageKey: string
  /** 事件时间 */
  time: string
  /** 持续时长（分钟），未恢复时为 null */
  durationMinutes: number | null
  /** 是否已通知（告警渠道） */
  notified: boolean
}

/** 生成最近告警事件（时间相对当前时刻） */
export function buildRecentAlerts(): AlertEvent[] {
  const now = dayjs()
  return [
    {
      id: 'a-2081',
      level: 'critical',
      monitor: '订单结算接口',
      target: 'https://api.beaconix.app/v2/orders/settle',
      messageKey: 'dashboard.alert.message.timeout',
      time: now.subtract(6, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      durationMinutes: null,
      notified: true,
    },
    {
      id: 'a-2079',
      level: 'warning',
      monitor: '海外 CDN 边缘节点',
      target: 'edge-sfo.beaconix.app',
      messageKey: 'dashboard.alert.message.packetLoss',
      time: now.subtract(42, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      durationMinutes: 18,
      notified: true,
    },
    {
      id: 'a-2074',
      level: 'critical',
      monitor: 'MySQL 主库',
      target: 'mysql-primary.internal:3306',
      messageKey: 'dashboard.alert.message.connectionRefused',
      time: now.subtract(3, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      durationMinutes: 4,
      notified: true,
    },
    {
      id: 'a-2066',
      level: 'recovered',
      monitor: '文件上传网关',
      target: 'https://oss.beaconix.app/upload',
      messageKey: 'dashboard.alert.message.recovered',
      time: now.subtract(5, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      durationMinutes: 12,
      notified: false,
    },
    {
      id: 'a-2058',
      level: 'warning',
      monitor: '报表导出服务',
      target: 'https://api.beaconix.app/v2/reports/export',
      messageKey: 'dashboard.alert.message.slowResponse',
      time: now.subtract(9, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      durationMinutes: 26,
      notified: true,
    },
  ]
}

/** 即将到期的证书 */
export interface ExpiringCertificate {
  host: string
  /** 剩余天数 */
  daysLeft: number
  /** 签发机构 */
  issuer: string
}

export const expiringCertificates: ExpiringCertificate[] = [
  { host: 'api.beaconix.app', daysLeft: 12, issuer: "Let's Encrypt" },
  { host: 'oss.beaconix.app', daysLeft: 26, issuer: 'DigiCert' },
]
