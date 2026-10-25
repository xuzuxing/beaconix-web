import type { AxiosRequestConfig } from 'axios'

import type {
  CreateSystemProbeParams,
  ProbeValidationChallenge,
  SystemProbe,
  SystemProbeAssignments,
  UpdateSystemProbeParams,
} from '../types/admin'
import { del, get, patch, post } from '@/utils/request'

/**
 * 管理后台 · 系统探针（仅 SUPER_ADMIN）。
 * 共享密钥（secret）只在创建响应里返回一次，列表与详情接口都不带该字段。
 */

/** 系统探针列表 */
export function listSystemProbes(config?: AxiosRequestConfig) {
  return get<SystemProbe[]>('/admin/system-probes', undefined, config)
}

/** 创建系统探针 */
export function createSystemProbe(data: CreateSystemProbeParams) {
  return post<SystemProbe>('/admin/system-probes', data)
}

/** 系统探针详情 */
export function getSystemProbe(id: string, config?: AxiosRequestConfig) {
  return get<SystemProbe>(`/admin/system-probes/${encodeURIComponent(id)}`, undefined, config)
}

/** 更新系统探针 */
export function updateSystemProbe(id: string, data: UpdateSystemProbeParams) {
  return patch<SystemProbe>(`/admin/system-probes/${encodeURIComponent(id)}`, data)
}

/** 删除系统探针 */
export function deleteSystemProbe(id: string) {
  return del<SystemProbe>(`/admin/system-probes/${encodeURIComponent(id)}`)
}

/** 启用 / 停用系统探针 */
export function toggleSystemProbe(id: string, enabled: boolean) {
  return patch<SystemProbe>(`/admin/system-probes/${encodeURIComponent(id)}/toggle`, { enabled })
}

/** 为系统探针创建一次联通校验挑战 */
export function validateSystemProbe(id: string) {
  return post<ProbeValidationChallenge>(`/admin/system-probes/${encodeURIComponent(id)}/validate`)
}

/** 重平衡系统探针的租户分配，返回探针 ID → 租户 ID 列表 */
export function rebalanceSystemProbes() {
  return post<SystemProbeAssignments>('/admin/system-probes/rebalance')
}
