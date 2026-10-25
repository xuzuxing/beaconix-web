import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { listStatusPages } from '@/api'
import type { StatusPage } from '@/api/types/status-page'
import { usePermissionsStore } from '@/stores/modules/permissions'

/**
 * 当前团队的状态页列表：切换团队时清空并重新加载。
 * generation 负责丢弃过期响应，切团队后旧请求不得回填列表。
 * 状态页是组织级资源，与当前项目无关。
 */
export function useStatusPageList(orgId: MaybeRefOrGetter<string | undefined>) {
  const { t } = useI18n()
  const permissions = usePermissionsStore()
  const pages = ref<StatusPage[]>([])
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
      pages.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result = await listStatusPages(organization, {
        signal: controller.signal,
      })
      if (token === generation) pages.value = result
    } catch (cause) {
      if (token === generation)
        error.value = cause instanceof Error ? cause.message : t('statusPage.loadFailed')
    } finally {
      if (token === generation) loading.value = false
    }
  }

  watch(
    () => toValue(orgId),
    () => {
      pages.value = []
      void load()
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })

  return { pages, loading, error, load }
}
