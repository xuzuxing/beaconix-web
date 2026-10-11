/**
 * 个人访问令牌（Personal Access Token）。
 * 契约见 docs/api-2.yaml：/api/users/me/personal-access-tokens。
 */

/** 可声明的权限范围；当前仅作标记，后端尚未按范围限制（令牌继承用户权限） */
export type PersonalAccessTokenScope =
  | 'monitors:read'
  | 'monitors:write'
  | 'probes:read'
  | 'probes:write'
  | 'status-pages:read'
  | 'status-pages:write'
  | 'monitoring:read'

/** 令牌实体（列表接口不返回明文，仅掩码后的元信息） */
export interface PersonalAccessToken {
  id: string
  userId: string
  name: string
  scopes: PersonalAccessTokenScope[]
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
  /** 明文令牌（JWT），仅创建响应返回一次，列表接口不返回 */
  token?: string
}

export interface CreatePersonalAccessTokenParams {
  name: string
  scopes?: PersonalAccessTokenScope[]
  /** 过期时间（ISO 8601）；不传表示后端默认 30 天 */
  expiresAt?: string
}
