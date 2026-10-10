import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'
import { listMonitors } from '@/api'
import type { Monitor } from '@/api/types'

/**
 * 当前项目的监控项列表：切换项目时清空并重新加载。
 * generation 负责丢弃过期响应，切项目后旧请求不得回填列表。
 */
export function useMonitorList(projectId: MaybeRefOrGetter<string | undefined>) {
  const { t } = useI18n()
  const monitors = ref<Monitor[]>([])
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined

  async function load() {
    const token = ++generation
    const project = toValue(projectId)
    controller?.abort()
    controller = new AbortController()
    error.value = ''
    if (!project) {
      monitors.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result = await listMonitors(project, { signal: controller.signal })
      if (token === generation) monitors.value = result
    } catch (cause) {
      if (token === generation)
        error.value = cause instanceof Error ? cause.message : t('monitorPage.loadFailed')
    } finally {
      if (token === generation) loading.value = false
    }
  }

  watch(
    () => toValue(projectId),
    () => {
      monitors.value = []
      void load()
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })

  return { monitors, loading, error, load }
}
