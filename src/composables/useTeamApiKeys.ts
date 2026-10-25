import { ref, watch, type Ref } from 'vue'

import { listApiKeys } from '@/api'
import type { ApiKey } from '@/api/types/team'
import { usePermissionsStore } from '@/stores/modules/permissions'

/**
 * 当前团队的 API 密钥列表。
 * 密钥值只在创建响应里返回一次，因此列表只持有掩码（keyPrefix）。
 */
export function useTeamApiKeys(orgId: Ref<string>) {
  const permissions = usePermissionsStore()
  const keys = ref<ApiKey[]>([])
  const loading = ref(false)
  const error = ref('')
  /** 正在作废的密钥 id */
  const pendingKey = ref('')
  let request = 0
  let loadedOrg = ''

  async function load() {
    const id = orgId.value
    const token = ++request
    if (id !== loadedOrg) keys.value = []
    loadedOrg = id
    error.value = ''

    if (!id || !permissions.canOrganization(id)) {
      keys.value = []
      loading.value = false
      return
    }

    loading.value = true
    try {
      const result = await listApiKeys(id)
      if (token !== request) return
      keys.value = result ?? []
    } catch (cause) {
      if (token !== request) return
      keys.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 串行执行作废等一次性动作，避免重复提交 */
  async function act(key: string, action: () => Promise<unknown>) {
    const id = orgId.value
    if (pendingKey.value || !permissions.canOrganization(id)) return
    pendingKey.value = key
    try {
      await permissions.ensureOrganization(id, true)
      if (id !== orgId.value || !permissions.canOrganization(id)) return
      await action()
    } finally {
      pendingKey.value = ''
    }
  }

  watch(orgId, load, { immediate: true })

  return { keys, loading, error, pendingKey, load, act }
}
