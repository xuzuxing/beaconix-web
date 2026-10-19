import type {
  PersonalAccessToken,
  PersonalAccessTokenScope,
} from '@/api/types/personal-access-token'

/**
 * 个人访问令牌的展现层纯函数：状态判定、范围与过期时间的表单校验、i18n key 映射。
 * 只做数据整形，不发请求，便于单元测试（test/personal-access-token-presenter.test.mjs）。
 */

/** 后端在未指定 expiresAt 时采用的默认有效期（天） */
export const PAT_DEFAULT_TTL_DAYS = 30

/** 全部权限范围，用于创建表单的候选项（与契约枚举一致） */
export const PAT_SCOPES: PersonalAccessTokenScope[] = [
  'monitors:read',
  'monitors:write',
  'probes:read',
  'probes:write',
  'status-pages:read',
  'status-pages:write',
  'monitoring:read',
]

/** 令牌可用状态：已吊销 / 已过期 / 可用 */
export type PatState = 'active' | 'revoked' | 'expired'

/** 状态判定：吊销优先于过期 */
export function patState(token: PersonalAccessToken, now = Date.now()): PatState {
  if (token.revokedAt) return 'revoked'
  if (token.expiresAt) {
    const expires = Date.parse(token.expiresAt)
    if (Number.isFinite(expires) && expires <= now) return 'expired'
  }
  return 'active'
}

/** 状态对应的 TDesign 标签主题 */
export function patStateTheme(state: PatState): 'success' | 'warning' | 'default' {
  if (state === 'active') return 'success'
  if (state === 'expired') return 'warning'
  return 'default'
}

/** 仍可吊销的令牌（已吊销的不再提供操作） */
export function canRevokePat(token: PersonalAccessToken, now = Date.now()): boolean {
  return patState(token, now) !== 'revoked'
}

/** 默认有效期（不传 expiresAt 时后端采用的 30 天）对应的到期时间，用于表单提示 */
export function patDefaultExpiry(from = Date.now()): string {
  return new Date(from + PAT_DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * 权限范围 → i18n key（monitors:read → workspace.pat.scope.monitorsRead）。
 * 带连字符的资源名转成小驼峰，动词首字母大写。
 */
export function patScopeLabelKey(scope: PersonalAccessTokenScope): string {
  const [resource = '', verb = ''] = String(scope).split(':')
  const camel = resource.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
  const suffix = verb ? `${verb.charAt(0).toUpperCase()}${verb.slice(1)}` : ''
  return `workspace.pat.scope.${camel}${suffix}`
}

export interface PatCreateValues {
  name: string
  scopes: string[]
  expiry: 'default' | 'custom'
  expiresAt: string
}

/**
 * 创建表单校验：返回 i18n key 后缀（空串表示通过）。
 * 调用方映射到 `workspace.pat.validation.*`。
 */
export function validatePatCreate(values: PatCreateValues, now = Date.now()): string {
  if (!values.name.trim()) return 'nameRequired'
  if (!values.scopes.length) return 'scopesRequired'
  if (values.expiry === 'custom') {
    if (!values.expiresAt) return 'expiresInvalid'
    const expires = Date.parse(values.expiresAt)
    if (!Number.isFinite(expires) || expires <= now) return 'expiresInvalid'
  }
  return ''
}
