import type { Monitor, MonitorStatus, MonitorType } from '../api/types.ts'

export const monitorStatus = (monitor: Pick<Monitor, 'enabled' | 'status'>): MonitorStatus =>
  !monitor.enabled ? 'PAUSED' : monitor.status === 'PAUSED' ? 'UNKNOWN' : monitor.status

export const monitorStatusTheme: Record<
  MonitorStatus,
  'success' | 'danger' | 'warning' | 'default'
> = {
  UP: 'success',
  DOWN: 'danger',
  DEGRADED: 'warning',
  UNKNOWN: 'default',
  PAUSED: 'default',
}
export type MonitorSort = 'newest' | 'name' | 'status' | 'latency'
export function selectMonitors(
  rows: Monitor[],
  search: string,
  status: MonitorStatus | 'all',
  type: MonitorType | 'all',
  sort: MonitorSort,
) {
  const query = search.trim().toLocaleLowerCase()
  const rank: Record<MonitorStatus, number> = { DOWN: 0, DEGRADED: 1, UNKNOWN: 2, UP: 3, PAUSED: 4 }
  return rows
    .filter(
      (row) =>
        (!query || `${row.name} ${row.target}`.toLocaleLowerCase().includes(query)) &&
        (status === 'all' || monitorStatus(row) === status) &&
        (type === 'all' || row.type === type),
    )
    .sort((a, b) => {
      const order =
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'status'
            ? rank[monitorStatus(a)] - rank[monitorStatus(b)]
            : sort === 'latency'
              ? (b.lastLatency ?? -1) - (a.lastLatency ?? -1)
              : Date.parse(b.createdAt) - Date.parse(a.createdAt)
      return order || a.id.localeCompare(b.id)
    })
}
export function summarizeMonitors(rows: Monitor[]) {
  const result = { total: rows.length, UP: 0, DOWN: 0, DEGRADED: 0, PAUSED: 0, UNKNOWN: 0 }
  rows.forEach((row) => {
    result[monitorStatus(row)]++
  })
  return result
}
export function formatMonitorTime(
  value: string | null | undefined,
  locale = 'zh-CN',
  timeZone?: string,
) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}
export function certificateDays(expiresAt: string | null, now: string | number) {
  if (!expiresAt) return null
  const difference = Date.parse(expiresAt) - (typeof now === 'number' ? now : Date.parse(now))
  return Number.isFinite(difference) ? Math.ceil(difference / 86400000) : null
}
