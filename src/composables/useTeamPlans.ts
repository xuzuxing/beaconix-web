import { ref } from 'vue'

import { getSubscriptionStack } from '@/api'
import type { Organization } from '@/api/types'
import type { Plan } from '@/api/types/billing'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { accessContext, isCurrentContext } from '@/utils/access-context'

/**
 * 各团队的套餐，供团队列表（顶栏团队下拉、选择团队页）展示套餐标签。
 * - 当前团队直接取 store 里已加载的订阅，不重复请求
 * - 其余团队按需拉取一次并缓存；失败按「无生效订阅」（免费版）处理，不阻塞列表
 */
export function useTeamPlans() {
  const orgStore = useOrganizationStore()
  const permissions = usePermissionsStore()
  const orgPlans = ref<Record<string, Plan | null>>({})
  let request = 0

  /** 某个团队的套餐：当前团队用 store，其余用按需缓存 */
  function planOf(org: Organization) {
    if (!permissions.canOrganization(org.id)) return null
    if (org.id === orgStore.currentOrganizationId) return orgStore.currentPlan
    return orgPlans.value[org.id] ?? null
  }

  /** 补齐尚未缓存的团队套餐（可重复调用，只请求缺失的团队） */
  async function loadTeamPlans(orgs: Organization[] = orgStore.organizations) {
    const token = ++request
    const context = accessContext()
    const pending = orgs.filter(
      (item) => item.id !== orgStore.currentOrganizationId && !(item.id in orgPlans.value),
    )
    await Promise.all(
      pending.map(async (item) => {
        try {
          await permissions.ensureOrganization(item.id)
          if (!permissions.canOrganization(item.id) || !isCurrentContext(context)) return
          const stack = await getSubscriptionStack(item.id)
          if (token !== request || !isCurrentContext(context)) return
          orgPlans.value = { ...orgPlans.value, [item.id]: stack?.effectivePlan ?? null }
        } catch {
          if (token !== request) return
          orgPlans.value = { ...orgPlans.value, [item.id]: null }
        }
      }),
    )
  }

  return { orgPlans, planOf, loadTeamPlans }
}
