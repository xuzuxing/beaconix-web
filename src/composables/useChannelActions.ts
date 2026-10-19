import { MessagePlugin } from 'tdesign-vue-next'
import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  deleteNotificationChannel,
  testNotificationChannel,
  updateNotificationChannel,
} from '@/api'
import type { NotificationChannel } from '@/api/types/notification'
import { usePermissionsStore } from '@/stores/modules/permissions'

export type ChannelAction = 'test' | 'toggle' | 'delete'

/**
 * 单个渠道上的行内操作。
 * - test：只提示投递结果，不改变列表
 * - toggle / delete：成功后回调 done() 重新拉取列表
 */
export function useChannelActions(scope: Ref<string>, done: () => Promise<void>) {
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

  async function act(orgId: string, channel: NotificationChannel, action: ChannelAction) {
    if (pending.value[channel.id] || !permissions.canOrganization(orgId)) return
    const token = generation
    pending.value[channel.id] = true
    actionError.value = ''
    try {
      await permissions.ensureOrganization(orgId, true)
      if (token !== generation || !permissions.canOrganization(orgId)) return
      if (action === 'test') {
        const result = await testNotificationChannel(orgId, channel.id)
        if (token !== generation) return
        if (result.delivered) MessagePlugin.success(t('channelPage.testDelivered'))
        else MessagePlugin.warning(t('channelPage.testFailed', { error: result.error ?? '' }))
      } else if (action === 'delete') {
        await deleteNotificationChannel(orgId, channel.id)
        if (token !== generation) return
        MessagePlugin.success(t('channelPage.deleted'))
      } else {
        await updateNotificationChannel(orgId, channel.id, {
          enabled: !channel.enabled,
        })
        if (token !== generation) return
        MessagePlugin.success(
          t(channel.enabled ? 'channelPage.disableDone' : 'channelPage.enableDone'),
        )
      }
      if (action !== 'test') await done()
    } catch (cause) {
      if (token === generation)
        actionError.value = cause instanceof Error ? cause.message : t('channelPage.actionFailed')
    } finally {
      if (token === generation) delete pending.value[channel.id]
    }
  }

  return { pending, actionError, act }
}
