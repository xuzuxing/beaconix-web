import type { AxiosRequestConfig } from 'axios'

import type { AdminPlan, CreateAdminPlanParams, UpdateAdminPlanParams } from '../types/admin'
import { del, get, patch, post } from '@/utils/request'

/**
 * 管理后台 · 套餐配置（仅 SUPER_ADMIN）。
 *
 * 与用户侧 `GET /plans`（只返回启用项、不含协议白名单）不同，这里能看到
 * 停用套餐并维护配额、特性开关与协议白名单。
 */

/** 后端可能直接返回数组，也可能套一层分页包装；两种都归一化成数组 */
function normalizePlanList(payload: AdminPlan[] | { items?: AdminPlan[] } | null): AdminPlan[] {
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload?.items) ? payload.items : []
}

/** 全量套餐列表（含停用项，按 sortOrder 升序由后端决定） */
export async function listAdminPlans(config?: AxiosRequestConfig) {
  const payload = await get<AdminPlan[] | { items?: AdminPlan[] }>(
    '/admin/plans',
    undefined,
    config,
  )
  return normalizePlanList(payload)
}

/** 套餐详情 */
export function getAdminPlan(id: string) {
  return get<AdminPlan>(`/admin/plans/${encodeURIComponent(id)}`)
}

/** 新建套餐 */
export function createAdminPlan(data: CreateAdminPlanParams) {
  return post<AdminPlan>('/admin/plans', data)
}

/** 更新套餐（启停也走这里，传 `{ enabled }` 即可） */
export function updateAdminPlan(id: string, data: UpdateAdminPlanParams) {
  return patch<AdminPlan>(`/admin/plans/${encodeURIComponent(id)}`, data)
}

/** 删除套餐；仍被订单 / 订阅引用时后端会拒绝 */
export function deleteAdminPlan(id: string) {
  return del<void>(`/admin/plans/${encodeURIComponent(id)}`)
}
