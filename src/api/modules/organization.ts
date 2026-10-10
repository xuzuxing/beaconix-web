import type { CreateOrganizationParams, Organization, UpdateOrganizationParams } from '../types'
import { del, get, patch, post } from '@/utils/request'

/** 创建组织（创建者成为 OWNER） */
export function createOrganization(data: CreateOrganizationParams) {
  return post<Organization>('/organizations', data)
}

/** 当前用户所属的组织列表 */
export function listOrganizations() {
  return get<Organization[]>('/organizations')
}

/** 组织详情（需成员身份） */
export function getOrganization(id: string) {
  return get<Organization>(`/organizations/${id}`)
}

/** 更新组织（ADMIN+） */
export function updateOrganization(id: string, data: UpdateOrganizationParams) {
  return patch<Organization>(`/organizations/${id}`, data)
}

/** 软删除组织（仅 OWNER） */
export function deleteOrganization(id: string) {
  return del<Organization>(`/organizations/${id}`)
}

/** 转移所有权（仅 OWNER） */
export function transferOwnership(id: string, newOwnerId: string) {
  return patch<Organization>(`/organizations/${id}/transfer`, { newOwnerId })
}
