import { MessagePlugin } from 'tdesign-vue-next'
import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteStatusPage, updateStatusPage } from '@/api'
import type { StatusPage } from '@/api/types/status-page'

export type StatusPageAction = 'toggle' | 'delete'

/**
 * 单个状态页上的行内操作。
 * 两者都会改变列表，成功后回调 done() 重新拉取。
 */
export function useStatusPageActions(scope: Ref<string>, done: () => Promise<void>) {
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

  async function act(orgId: string, page: StatusPage, action: StatusPageAction) {
    if (pending.value[page.id]) return
    const token = generation
    pending.value[page.id] = true
    actionError.value = ''
    try {
      if (action === 'delete') {
        await deleteStatusPage(orgId, page.id)
        if (token !== generation) return
        MessagePlugin.success(t('statusPage.deleted'))
      } else {
        await updateStatusPage(orgId, page.id, { enabled: !page.enabled })
        if (token !== generation) return
        MessagePlugin.success(t(page.enabled ? 'statusPage.disableDone' : 'statusPage.enableDone'))
      }
      await done()
    } catch (cause) {
      if (token === generation)
        actionError.value = cause instanceof Error ? cause.message : t('statusPage.actionFailed')
    } finally {
      if (token === generation) delete pending.value[page.id]
    }
  }

  return { pending, actionError, act }
}
