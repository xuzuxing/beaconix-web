import { computed, onScopeDispose, ref, watch } from 'vue'
import { listMembers } from '@/api'
import type { MembershipRole } from '@/api/types'
import { useOrganizationStore, useUserStore } from '@/stores'

/**
 * 当前团队内登录用户的角色与由此派生的权限位。
 * 管理类资源（监控项 / 通知渠道 …）共用同一套判定：
 * - canManage：SUPER_ADMIN、OWNER、ADMIN
 * - canCheck：在 canManage 之外额外允许 MEMBER（执行类只读动作）
 * 成员查询失败时降级为只读，避免误放行写操作。
 */
export function useOrganizationRole() {
  const org = useOrganizationStore()
  const user = useUserStore()
  const role = ref<MembershipRole>()
  let generation = 0
  onScopeDispose(() => {
    generation++
  })
  watch(
    () => [org.currentOrganizationId, user.user?.id],
    async () => {
      const token = ++generation
      role.value = undefined
      if (!org.currentOrganizationId || !user.user?.id || user.isSuperAdmin) return
      try {
        const members = await listMembers(org.currentOrganizationId)
        if (token === generation)
          role.value = members.find((member) => member.userId === user.user?.id)?.role
      } catch {
        // Read-only remains available if membership lookup fails.
      }
    },
    { immediate: true },
  )
  const canManage = computed(
    () => user.isSuperAdmin || role.value === 'OWNER' || role.value === 'ADMIN',
  )
  const canCheck = computed(() => canManage.value || role.value === 'MEMBER')
  return { role, canManage, canCheck }
}
