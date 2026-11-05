import { useIntervalFn, useNow } from '@vueuse/core'
import type { Monitor } from '@/api/types'
import { monitorCapacityRestricted, monitorStatus } from '@/utils/monitor-presenter'

/** Deadline transitions must update even when the user has disabled network auto-refresh. */
export function useMonitorRuntime() {
  const now = useNow({ scheduler: (callback) => useIntervalFn(callback, 1000) })
  return {
    now,
    status: (monitor: Parameters<typeof monitorStatus>[0]) =>
      monitorStatus(monitor, now.value.getTime()),
    restricted: (monitor: Pick<Monitor, 'executionBlockedReason' | 'quotaGraceEndsAt'>) =>
      monitorCapacityRestricted(monitor, now.value.getTime()),
  }
}
