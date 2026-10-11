import type { ApiKey, CreateApiKeyParams } from '../types/team'
import { get, post } from '@/utils/request'

/**
 * 组织 API 密钥（开发者密钥）。
 * 密钥值只在创建响应里返回一次，列表与作废接口返回的都是掩码（keyPrefix）。
 */

/** 组织下的 API 密钥列表（需成员身份） */
export function listApiKeys(orgId: string) {
  return get<ApiKey[]>(`/organizations/${encodeURIComponent(orgId)}/api-keys`)
}

/** 创建 API 密钥（ADMIN+，仅本次响应返回完整密钥） */
export function createApiKey(orgId: string, data: CreateApiKeyParams) {
  return post<ApiKey>(`/organizations/${encodeURIComponent(orgId)}/api-keys`, data)
}

/** 作废 API 密钥（ADMIN+） */
export function revokeApiKey(orgId: string, id: string) {
  return post<ApiKey>(
    `/organizations/${encodeURIComponent(orgId)}/api-keys/${encodeURIComponent(id)}/revoke`,
  )
}
