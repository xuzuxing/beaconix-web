import type { Dashboard, NullableNumber } from '../api/types/monitoring.ts'

export interface MonitorTimeline {
  labels: string[]
  checks: NullableNumber[]
  failures: NullableNumber[]
  avgLatency: NullableNumber[]
  latencyP50: NullableNumber[]
  latencyP95: NullableNumber[]
  latencyP99: NullableNumber[]
  availability: NullableNumber[]
}
export interface MonitorKpi {
  key: string
  labelKey: string
  value: string
  unitKey?: string
  deltaText: string
  good: boolean
  tone: 'brand' | 'success' | 'warning' | 'error'
  trend: NullableNumber[]
  tipKey?: string
}
export const formatMetric = (value: NullableNumber, decimals = 0) =>
  value === null ? '-' : value.toFixed(decimals)
// Retain offsets to distinguish repeated local hours during DST.
export const timeLabel = (iso: string) =>
  `${iso.slice(5, 16).replace('T', ' ')} ${iso.match(/(?:Z|[+-]\d{2}:\d{2})$/)?.[0] ?? ''}`.trim()

export function adaptTimeline(data: Dashboard): MonitorTimeline {
  const points = data.timeline.points
  return {
    labels: points.map((p) => timeLabel(p.time)),
    avgLatency: points.map((p) => p.avgLatencyMs),
    checks: points.map((p) => p.checks),
    failures: points.map((p) => p.failures),
    latencyP50: points.map((p) => p.latencyP50Ms),
    latencyP95: points.map((p) => p.latencyP95Ms),
    latencyP99: points.map((p) => p.latencyP99Ms),
    availability: points.map((p) => p.uptimePercent),
  }
}
export function adaptKpis(data: Dashboard): MonitorKpi[] {
  const k = data.kpis
  const entries: Array<
    [
      string,
      NullableNumber,
      NullableNumber,
      NullableNumber[],
      string | undefined,
      boolean,
      MonitorKpi['tone'],
    ]
  > = [
    [
      'availability',
      k.uptimePercent,
      k.uptimeDeltaPercent,
      data.sparklines.uptime,
      'percent',
      true,
      'success',
    ],
    [
      'latency',
      k.avgLatencyMs,
      k.avgLatencyDeltaMs,
      data.sparklines.avgLatency,
      'ms',
      false,
      'brand',
    ],
    [
      'p95',
      k.p95LatencyMs,
      k.p95LatencyDeltaMs,
      data.sparklines.p95Latency,
      'ms',
      false,
      'warning',
    ],
    [
      'failingRate',
      k.failureRatePercent,
      k.failureRateDeltaPercent,
      data.sparklines.failureRate,
      'percent',
      false,
      'error',
    ],
    [
      'monitors',
      k.monitorCount,
      k.monitorDelta,
      data.sparklines.monitorCount,
      undefined,
      true,
      'brand',
    ],
    [
      'failing',
      k.failingCount,
      k.failingDelta,
      data.sparklines.failing,
      undefined,
      false,
      'warning',
    ],
  ]
  return entries.map(([key, value, delta, trend, unit, higherGood, tone]) => ({
    key,
    labelKey: `dashboard.kpi.${key}`,
    value: formatMetric(value, unit === 'percent' ? 2 : 0),
    unitKey: value !== null && unit ? `dashboard.unit.${unit}` : undefined,
    deltaText:
      delta === null
        ? ''
        : `${delta > 0 ? '+' : ''}${formatMetric(delta, unit === 'percent' ? 2 : 0)}${unit === 'percent' ? ' pp' : unit === 'ms' ? ' ms' : ''}`,
    good: delta === null || delta === 0 || (higherGood ? delta > 0 : delta < 0),
    tone,
    trend,
    tipKey: `dashboard.kpi.${key}Tip`,
  }))
}
export function finiteSegments(values: NullableNumber[], min: number, max: number, height = 100) {
  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (current.length) segments.push(current)
      current = []
    } else
      current.push({
        x: values.length > 1 ? (100 * i) / (values.length - 1) : 50,
        y: height - ((v - min) / (max - min || 1)) * height,
      })
  })
  if (current.length) segments.push(current)
  return segments
}
