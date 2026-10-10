import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { deleteMonitor, pauseMonitor, resumeMonitor, runMonitorCheck } from '@/api'
import type { Monitor } from '@/api/types'

export type MonitorAction = 'check' | 'toggle' | 'delete'
export function useMonitorActions(
  scope: Ref<string>,
  done: (action: MonitorAction) => Promise<void>,
) {
  const { t } = useI18n()
  const pending = ref<Record<string, boolean>>({})
  const actionError = ref('')
  let generation = 0
  watch(
    scope,
    () => {
      generation++
      pending.value = {}
      actionError.value = ''
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
  })
  async function act(projectId: string, monitor: Monitor, action: MonitorAction) {
    if (pending.value[monitor.id]) return
    const token = generation
    pending.value[monitor.id] = true
    actionError.value = ''
    try {
      if (action === 'check') await runMonitorCheck(projectId, monitor.id)
      else if (action === 'delete') await deleteMonitor(projectId, monitor.id)
      else await (monitor.enabled ? pauseMonitor : resumeMonitor)(projectId, monitor.id)
      if (token !== generation) return
      if (action !== 'toggle')
        MessagePlugin.success(t(`workspace.monitor.${action === 'check' ? 'checked' : 'deleted'}`))
      await done(action)
    } catch (cause) {
      if (token === generation)
        actionError.value = cause instanceof Error ? cause.message : t('monitorPage.loadFailed')
    } finally {
      if (token === generation) delete pending.value[monitor.id]
    }
  }
  return { pending, actionError, act }
}
