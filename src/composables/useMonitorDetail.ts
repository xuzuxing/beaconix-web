import { onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { getMonitor, getMonitorInsights } from '@/api'
import type { Monitor } from '@/api/types'
import type { MonitorDetailRange, MonitorInsights } from '@/api/types/monitor-detail'

export function useMonitorDetail(
  projectId: Ref<string>,
  monitorId: Ref<string>,
  range: Ref<MonitorDetailRange>,
  tz: Ref<string>,
) {
  const monitor = shallowRef<Monitor>()
  const insights = shallowRef<MonitorInsights>()
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined
  async function refresh() {
    const token = ++generation
    controller?.abort()
    controller = new AbortController()
    error.value = ''
    if (!projectId.value || !monitorId.value) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const config = { signal: controller.signal }
      const [item, data] = await Promise.all([
        getMonitor(projectId.value, monitorId.value, config),
        getMonitorInsights(
          projectId.value,
          monitorId.value,
          { range: range.value, tz: tz.value },
          config,
        ),
      ])
      if (token !== generation) return
      monitor.value = item
      insights.value = data
    } catch (cause) {
      if (token === generation) {
        monitor.value = undefined
        insights.value = undefined
        error.value = cause instanceof Error ? cause.message : 'Unable to load monitor'
      }
    } finally {
      if (token === generation) loading.value = false
    }
  }
  watch(
    [projectId, monitorId, range, tz],
    () => {
      monitor.value = undefined
      insights.value = undefined
      void refresh()
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })
  return { monitor, insights, loading, error, refresh }
}
