import type { AdminTenant } from '../types/admin'
import { get, patch } from '@/utils/request'

/**
 * 管理后台 · 租户管理（仅 SUPER_ADMIN）。
 * 列表接口为跨租户查询，会同时返回已软删除的组织（active=false）。
 */

/** 平台上的全部租户 */
export function listAdminTenants() {
  return get<AdminTenant[]>('/admin/tenants')
}

/** 单个租户详情 */
export function getAdminTenant(id: string) {
  return get<AdminTenant>(`/admin/tenants/${encodeURIComponent(id)}`)
}

/** 启用 / 停用租户：活跃时软删除，已删除时恢复 */
export function toggleAdminTenant(id: string) {
  return patch<AdminTenant>(`/admin/tenants/${encodeURIComponent(id)}/toggle`)
}
