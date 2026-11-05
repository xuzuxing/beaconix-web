import { onScopeDispose, readonly, shallowRef } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import {
  createRumAlertRule,
  deleteRumAlertRule,
  listRumAlertChannels,
  listRumAlertIncidents,
  listRumAlertRules,
  updateRumAlertRule,
} from '@/api/modules/rum'
import type { RumAlertInput } from '@/api/types/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import { accessContext, isCurrentContext } from '@/utils/access-context'

export function useRumAlerts() {
  const { t } = useI18n()
  const context = useRumContext()
  const incidentPage = shallowRef(1)
  const incidentStatus = shallowRef('')
  const submitting = shallowRef(false)
  let disposed = false

  onScopeDispose(() => {
    disposed = true
  })

  const rules = useRumResource(
    (signal) => listRumAlertRules(context.projectId.value, context.appId.value, { signal }),
    [context.projectId, context.appId],
  )
  const incidents = useRumResource(
    (signal) =>
      listRumAlertIncidents(
        context.projectId.value,
        context.appId.value,
        {
          page: incidentPage.value,
          limit: 20,
          status: incidentStatus.value || undefined,
        },
        { signal },
      ),
    [context.projectId, context.appId, incidentPage, incidentStatus],
  )
  const channels = useRumResource(
    (signal) =>
      context.canManage.value
        ? listRumAlertChannels(context.projectId.value, context.appId.value, { signal })
        : Promise.resolve([]),
    [context.projectId, context.appId, context.canManage],
  )

  function setIncidentPage(value: number) {
    incidentPage.value = value
  }

  function setIncidentStatus(value: string) {
    incidentStatus.value = value
    incidentPage.value = 1
  }

  async function saveRule(ruleId: string, input: RumAlertInput) {
    if (submitting.value) return false
    const original = rules.data.value?.find((rule) => rule.id === ruleId)
    if (original?.enabled && !input.enabled && !window.confirm(t('rum.ruleDisable'))) return false
    const ctx = accessContext()
    const projectId = context.projectId.value
    const appId = context.appId.value
    submitting.value = true
    try {
      if (!(await context.authorizeWrite()) || disposed || !isCurrentContext(ctx)) return false
      if (ruleId) await updateRumAlertRule(projectId, appId, ruleId, input)
      else await createRumAlertRule(projectId, appId, input)
      if (!disposed && isCurrentContext(ctx))
        await Promise.all([rules.reload(), incidents.reload()])
      return true
    } catch {
      if (!disposed && isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
      return false
    } finally {
      submitting.value = false
    }
  }

  async function removeRule(ruleId: string) {
    if (submitting.value || !window.confirm(t('rum.ruleDelete'))) return
    const ctx = accessContext()
    const projectId = context.projectId.value
    const appId = context.appId.value
    submitting.value = true
    try {
      if (!(await context.authorizeWrite()) || disposed || !isCurrentContext(ctx)) return
      await deleteRumAlertRule(projectId, appId, ruleId)
      if (!disposed && isCurrentContext(ctx))
        await Promise.all([rules.reload(), incidents.reload()])
    } catch {
      if (!disposed && isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
    } finally {
      submitting.value = false
    }
  }

  return {
    ...context,
    rules,
    incidents,
    channels,
    incidentPage: readonly(incidentPage),
    incidentStatus: readonly(incidentStatus),
    submitting: readonly(submitting),
    setIncidentPage,
    setIncidentStatus,
    saveRule,
    removeRule,
  }
}
