import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { get } from '@/utils/request'
import { MonitoringRequestState, type ConditionalResponse } from '@/utils/monitoring-request-state'
import type { Availability, Dashboard, MonitorRange, StatusCodes } from '@/api/types/monitoring'

export interface MonitoringDashboardOptions {
  /** 是否同时拉取可用性热力图与状态码；只用大盘数据的页面（如监控概览）可关掉 */
  withAvailability?: boolean
}

export function useMonitoringDashboard(
  projectId: Ref<string | undefined>,
  range: Ref<MonitorRange>,
  tz: Ref<string>,
  options: MonitoringDashboardOptions = {},
) {
  const withAvailability = options.withAvailability !== false
  const dashboard = ref<Dashboard>()
  const availability = ref<Availability>()
  const statusCodes = ref<StatusCodes>()
  const loading = ref(false)
  const error = ref('')
  const revision = ref(0)
  const state = new MonitoringRequestState()
  let controller: AbortController | undefined
  watch(
    [projectId, range, tz, revision],
    async () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      const token = state.begin()
      dashboard.value = undefined
      availability.value = undefined
      statusCodes.value = undefined
      error.value = ''
      if (!projectId.value) {
        loading.value = false
        return
      }
      loading.value = true
      const base = `/projects/${encodeURIComponent(projectId.value)}/monitoring`
      const load = <T>(endpoint: string, params: Record<string, unknown>) =>
        state.load<T>(`${base}/${endpoint}:${JSON.stringify(params)}`, (etag) =>
          get<ConditionalResponse<T>>(`${base}/${endpoint}`, params, {
            signal,
            validateStatus: (status) => status === 200 || status === 304,
            headers: {
              'X-Monitoring-Conditional': '1',
              ...(etag ? { 'If-None-Match': etag } : {}),
            },
          }),
        )
      try {
        const [d, a, s] = await Promise.all([
          load<Dashboard>('dashboard', { range: range.value, tz: tz.value }),
          withAvailability
            ? load<Availability>('availability', { days: 30, tz: tz.value })
            : undefined,
          withAvailability
            ? load<StatusCodes>('status-codes', { hours: 12, tz: tz.value })
            : undefined,
        ])
        if (!state.current(token)) return
        dashboard.value = d
        availability.value = a
        statusCodes.value = s
      } catch (cause) {
        if (state.current(token) && !signal.aborted)
          error.value = cause instanceof Error ? cause.message : String(cause)
      } finally {
        if (state.current(token)) loading.value = false
      }
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    controller?.abort()
    state.clear()
  })
  return {
    dashboard,
    availability,
    statusCodes,
    loading,
    error,
    refresh: () => revision.value++,
  }
}
