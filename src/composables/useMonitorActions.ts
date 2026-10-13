import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import {
  deleteMonitor,
  pauseMonitor,
  resumeMonitor,
  runMonitorCheck,
  testMonitorAlert,
} from '@/api'
import type { Monitor } from '@/api/types'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { accessContext, isCurrentContext } from '@/utils/access-context'

export type MonitorAction = 'check' | 'toggle' | 'delete' | 'test-alert'
export function useMonitorActions(
  scope: Ref<string>,
  done: (action: MonitorAction) => Promise<void>,
) {
  const { t } = useI18n()
  const permissions = usePermissionsStore()
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
    const context = accessContext()
    pending.value[monitor.id] = true
    actionError.value = ''
    try {
      await permissions.ensureProject(projectId, true)
      const capability =
        action === 'check'
          ? 'monitor.check'
          : action === 'test-alert'
            ? 'monitor.test-alert'
            : 'monitor.manage'
      if (
        token !== generation ||
        !isCurrentContext(context) ||
        !permissions.canProject(projectId, capability)
      )
        return
      if (action === 'check') await runMonitorCheck(projectId, monitor.id)
      else if (action === 'test-alert') await testMonitorAlert(projectId, monitor.id)
      else if (action === 'delete') await deleteMonitor(projectId, monitor.id)
      else await (monitor.enabled ? pauseMonitor : resumeMonitor)(projectId, monitor.id)
      if (token !== generation) return
      if (action === 'test-alert') MessagePlugin.success(t('access.testAlertSent'))
      else if (action !== 'toggle')
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
