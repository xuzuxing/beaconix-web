import { ref, watch, type Ref } from 'vue'

import { listInvitations, listMembers } from '@/api'
import type { Invitation, Membership } from '@/api/types'
import { usePermissionsStore } from '@/stores/modules/permissions'

/**
 * 当前团队的成员与待处理邀请。
 * - 邀请列表接口仅 ADMIN+ 可读，因此只在可管理时拉取，失败时单独标记而不影响成员列表
 * - 团队切换（或角色就绪）时整体重载，并用请求序号丢弃过期响应
 */
export function useTeamMembers(orgId: Ref<string>, canManage: Ref<boolean>) {
  const permissions = usePermissionsStore()
  const members = ref<Membership[]>([])
  const invitations = ref<Invitation[]>([])
  const loading = ref(false)
  const error = ref('')
  /** 邀请列表不可读（角色不足或接口失败） */
  const invitationsDenied = ref(false)
  /** 正在提交的动作标识（成员 id / 邀请 id），用于禁用重复提交 */
  const pendingKey = ref('')
  let request = 0
  let loadedOrg = ''

  async function load() {
    const id = orgId.value
    const token = ++request
    if (id !== loadedOrg) {
      members.value = []
      invitations.value = []
      invitationsDenied.value = false
    }
    loadedOrg = id
    error.value = ''

    if (!id || !canManage.value) {
      members.value = []
      invitations.value = []
      loading.value = false
      return
    }

    loading.value = true
    try {
      const result = await listMembers(id)
      if (token !== request) return
      members.value = result ?? []
    } catch (cause) {
      if (token !== request) return
      members.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }

    if (token !== request || !canManage.value) return
    try {
      const result = await listInvitations(id)
      if (token !== request) return
      invitations.value = result ?? []
      invitationsDenied.value = false
    } catch {
      if (token !== request) return
      invitations.value = []
      invitationsDenied.value = true
    }
  }

  /** 串行执行一次性动作（改角色 / 移除成员 / 撤销邀请），避免重复提交 */
  async function act(key: string, action: () => Promise<unknown>) {
    if (pendingKey.value || !canManage.value) return
    const id = orgId.value
    pendingKey.value = key
    try {
      await permissions.ensureOrganization(id, true)
      if (id !== orgId.value || !canManage.value) return
      await action()
    } finally {
      pendingKey.value = ''
    }
  }

  watch([orgId, canManage], load, { immediate: true })

  return {
    members,
    invitations,
    loading,
    error,
    invitationsDenied,
    pendingKey,
    load,
    act,
  }
}
