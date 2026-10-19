import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'
import { listNotificationChannels } from '@/api'
import type { NotificationChannel } from '@/api/types/notification'
import { usePermissionsStore } from '@/stores/modules/permissions'

/**
 * 当前团队的通知渠道列表：切换团队时清空并重新加载。
 * generation 负责丢弃过期响应，切团队后旧请求不得回填列表。
 * 渠道是组织级资源，与当前项目无关。
 */
export function useChannelList(orgId: MaybeRefOrGetter<string | undefined>) {
  const { t } = useI18n()
  const permissions = usePermissionsStore()
  const channels = ref<NotificationChannel[]>([])
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined

  async function load() {
    const token = ++generation
    const organization = toValue(orgId)
    controller?.abort()
    controller = new AbortController()
    error.value = ''
    if (!organization || !permissions.canOrganization(organization)) {
      channels.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result = await listNotificationChannels(organization, {
        signal: controller.signal,
      })
      if (token === generation) channels.value = result
    } catch (cause) {
      if (token === generation)
        error.value = cause instanceof Error ? cause.message : t('channelPage.loadFailed')
    } finally {
      if (token === generation) loading.value = false
    }
  }

  watch(
    () => toValue(orgId),
    () => {
      channels.value = []
      void load()
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })

  return { channels, loading, error, load }
}
