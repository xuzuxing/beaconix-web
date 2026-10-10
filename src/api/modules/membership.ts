import type { Membership, MembershipRole } from '../types'
import { del, get, patch } from '@/utils/request'

/** 组织成员列表 */
export function listMembers(orgId: string) {
  return get<Membership[]>(`/organizations/${orgId}/members`)
}

/** 修改成员角色（ADMIN+） */
export function updateMemberRole(orgId: string, userId: string, role: MembershipRole) {
  return patch<Membership>(`/organizations/${orgId}/members/${userId}`, { role })
}

/** 移除成员（ADMIN+） */
export function removeMember(orgId: string, userId: string) {
  return del<void>(`/organizations/${orgId}/members/${userId}`)
}

/** 退出组织（OWNER 需先转移所有权） */
export function leaveOrganization(orgId: string) {
  return del<void>(`/organizations/${orgId}/members/me`)
}
