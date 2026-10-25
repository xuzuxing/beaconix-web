import { ref } from 'vue'

import { getAdminMetricsOverview, getAdminSchedulerHealth, getAdminTenantMetrics } from '@/api'
import type {
  AdminMetricsOverview,
  AdminSchedulerHealth,
  AdminTenantMetric,
} from '@/api/types/admin'

/**
 * 平台指标快照（仅 SUPER_ADMIN）。
 * 三个接口一起拉取，任一失败都整体降级为错误态；用请求序号丢弃过期响应。
 */
export function useAdminMetrics() {
  const overview = ref<AdminMetricsOverview | null>(null)
  const scheduler = ref<AdminSchedulerHealth | null>(null)
  const tenantMetrics = ref<AdminTenantMetric[]>([])
  const loading = ref(false)
  const error = ref('')
  let request = 0

  function reset() {
    overview.value = null
    scheduler.value = null
    tenantMetrics.value = []
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const [nextOverview, nextScheduler, nextTenants] = await Promise.all([
        getAdminMetricsOverview(),
        getAdminSchedulerHealth(),
        getAdminTenantMetrics(),
      ])
      if (token !== request) return
      overview.value = nextOverview ?? null
      scheduler.value = nextScheduler ?? null
      tenantMetrics.value = nextTenants ?? []
    } catch (cause) {
      if (token !== request) return
      reset()
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  return { overview, scheduler, tenantMetrics, loading, error, load }
}
