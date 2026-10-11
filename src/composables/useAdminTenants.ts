import { computed, ref } from 'vue'

import { listAdminTenants, toggleAdminTenant } from '@/api'
import type { AdminTenant } from '@/api/types/admin'
import { selectAdminTenants, type AdminTenantState } from '@/utils/admin-presenter'

/**
 * 跨租户租户列表：一次拉全量后在前端做关键词与状态筛选（接口不分页）。
 * 停用 / 恢复走 `PATCH /admin/tenants/:id/toggle`，只有被操作的一行进入 loading。
 */
export function useAdminTenants() {
  const tenants = ref<AdminTenant[]>([])
  const loading = ref(false)
  const error = ref('')
  const keyword = ref('')
  const state = ref<AdminTenantState>('all')
  const togglingId = ref('')
  let request = 0

  const filtered = computed(() => selectAdminTenants(tenants.value, keyword.value, state.value))

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listAdminTenants()
      if (token !== request) return
      tenants.value = result ?? []
    } catch (cause) {
      if (token !== request) return
      tenants.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 就地替换被切换的那一行，避免整表重载导致筛选与滚动位置丢失 */
  async function toggle(tenant: AdminTenant): Promise<AdminTenant | null> {
    togglingId.value = tenant.id
    try {
      const updated = await toggleAdminTenant(tenant.id)
      const index = tenants.value.findIndex((item) => item.id === tenant.id)
      if (index >= 0) tenants.value.splice(index, 1, updated)
      return updated
    } finally {
      togglingId.value = ''
    }
  }

  return { tenants, filtered, loading, error, keyword, state, togglingId, load, toggle }
}
