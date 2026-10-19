import type { Invitation, InvitationStatus, Membership, MembershipRole } from '@/api/types'
import type { ApiKey, ApiKeyScope, AuditAction, AuditLog } from '@/api/types/team'

/**
 * 团队管理页的展现层纯函数：成员身份展示与筛选、邀请状态、API 密钥状态、审计日志渲染。
 * 只做数据整形，不发请求，便于单元测试（test/team-presenter.test.mjs）。
 */

// ============================================================
// 成员
// ============================================================

/** 成员角色，权限自低到高；OWNER 只由转移所有权产生，不参与普通下拉 */
export const MEMBER_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']

/** 可在成员列表里直接指派的角色（OWNER 需走「转移所有权」） */
export const ASSIGNABLE_ROLES: MembershipRole[] = ['ADMIN', 'MEMBER', 'VIEWER']

/** 可邀请的角色 */
export const INVITABLE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const

/** 成员身份展示信息 */
export interface MemberIdentity {
  /** 主标题：姓名，未内嵌用户资料时回退为 userId 短码 */
  name: string
  /** 副标题：邮箱，缺失时为空串 */
  email: string
  /** 头像文字：姓名或 userId 首字母 */
  initial: string
  /** 是否处于「无用户资料」的回退展示 */
  fallback: boolean
}

/** userId 在列表里的紧凑展示：保留首尾，中间省略 */
export function shortId(id: string): string {
  if (!id) return '-'
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

/**
 * 成员身份：优先用内嵌用户资料，缺失时回退展示 userId 短码。
 * 后端只在响应中内嵌 user 时才拿得到姓名与邮箱。
 */
export function memberIdentity(member: Membership): MemberIdentity {
  const name = member.user?.name?.trim() ?? ''
  const email = member.user?.email?.trim() ?? ''
  if (name) {
    return {
      name,
      email,
      initial: name.slice(0, 1).toUpperCase(),
      fallback: false,
    }
  }
  const fallbackId = member.userId || member.id
  return {
    name: shortId(fallbackId),
    email,
    initial: (fallbackId || '?').slice(0, 1).toUpperCase(),
    fallback: true,
  }
}

/** 成员是否匹配关键词（姓名 / 邮箱 / userId） */
export function memberMatches(member: Membership, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  const identity = memberIdentity(member)
  return [identity.name, identity.email, member.userId, member.user?.id ?? '']
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(kw))
}

/**
 * 成员列表筛选：
 * - keyword 匹配姓名 / 邮箱 / userId
 * - role 为 'all' 时不按角色过滤
 * OWNER 恒排在最前，其余按加入时间倒序（新成员在前）。
 */
export function selectMembers(
  members: readonly Membership[],
  keyword: string,
  role: MembershipRole | 'all',
): Membership[] {
  const rank = (item: MembershipRole) => (item === 'OWNER' ? 0 : 1)
  return members
    .filter((member) => (role === 'all' ? true : member.role === role))
    .filter((member) => memberMatches(member, keyword))
    .slice()
    .sort((a, b) => rank(a.role) - rank(b.role) || b.joinedAt.localeCompare(a.joinedAt))
}

/**
 * 成员可执行的操作。
 * - 自己不能被自己移除或降级
 * - OWNER 的成员关系只能通过转移所有权（后端）变更
 * - 只有 canManage（SUPER_ADMIN / OWNER / ADMIN）能改角色或移除
 */
export function memberPermissions(
  member: Membership,
  options: {
    currentUserId?: string
    canManage: boolean
    canGrantAdmin?: boolean
  },
) {
  const isSelf = Boolean(options.currentUserId) && member.userId === options.currentUserId
  const isOwner = member.role === 'OWNER'
  return {
    isSelf,
    isOwner,
    canChangeRole:
      options.canManage &&
      !isSelf &&
      !isOwner &&
      (member.role !== 'ADMIN' || options.canGrantAdmin === true),
    canRemove:
      options.canManage &&
      !isSelf &&
      !isOwner &&
      (member.role !== 'ADMIN' || options.canGrantAdmin === true),
  }
}

// ============================================================
// 邀请
// ============================================================

/** 邀请状态对应的 TDesign 标签主题 */
export function invitationTheme(
  status: InvitationStatus,
): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'PENDING':
      return 'warning'
    case 'ACCEPTED':
      return 'success'
    case 'DECLINED':
    case 'EXPIRED':
    case 'REVOKED':
      return 'default'
    default:
      return 'default'
  }
}

/** 邀请是否仍待处理（只有待处理的才能撤销） */
export function isPendingInvitation(invitation: Invitation): boolean {
  return invitation.status === 'PENDING'
}

/** 待处理邀请置前，其余按创建时间倒序 */
export function selectInvitations(invitations: readonly Invitation[]): Invitation[] {
  const rank = (status: InvitationStatus) => (status === 'PENDING' ? 0 : 1)
  return invitations
    .slice()
    .sort((a, b) => rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt))
}

/** 邀请是否已过期（前端按时间判断，后端到期后才会把状态改成 EXPIRED） */
export function isInvitationExpired(invitation: Invitation, now = Date.now()): boolean {
  if (!invitation.expiresAt) return false
  const expires = Date.parse(invitation.expiresAt)
  return Number.isFinite(expires) && expires <= now
}

// ============================================================
// API 密钥
// ============================================================

/** 密钥可用状态：已作废 / 已过期 / 可用 */
export type ApiKeyState = 'active' | 'revoked' | 'expired'

export function apiKeyState(key: ApiKey, now = Date.now()): ApiKeyState {
  if (key.revokedAt) return 'revoked'
  if (key.expiresAt) {
    const expires = Date.parse(key.expiresAt)
    if (Number.isFinite(expires) && expires <= now) return 'expired'
  }
  return 'active'
}

/** 密钥状态对应的 TDesign 标签主题 */
export function apiKeyStateTheme(state: ApiKeyState): 'success' | 'warning' | 'default' {
  if (state === 'active') return 'success'
  if (state === 'expired') return 'warning'
  return 'default'
}

/** 仍可作废的密钥（已作废的不再提供操作） */
export function canRevokeApiKey(key: ApiKey, now = Date.now()): boolean {
  return apiKeyState(key, now) !== 'revoked'
}

/** 列表里的密钥展示：优先 keyPrefix，缺失时用 id 短码兜底 */
export function apiKeyDisplay(key: ApiKey): string {
  const prefix = key.keyPrefix?.trim()
  return prefix ? `${prefix}••••••••` : shortId(key.id)
}

/** 全部权限范围，用于创建表单的候选项 */
export const API_KEY_SCOPES = [
  'monitors:read',
  'monitors:write',
  'probes:read',
  'probes:write',
  'status-pages:read',
  'status-pages:write',
  'monitoring:read',
] as const

/**
 * 权限范围 → i18n key（monitors:read → workspace.apiKey.scope.monitorsRead）。
 * 带连字符的资源名转成小驼峰，动词首字母大写。
 */
export function apiKeyScopeLabelKey(scope: ApiKeyScope): string {
  const [resource = '', verb = ''] = String(scope).split(':')
  const camel = resource.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
  const suffix = verb ? `${verb.charAt(0).toUpperCase()}${verb.slice(1)}` : ''
  return `workspace.apiKey.scope.${camel}${suffix}`
}

// ============================================================
// 审计日志
// ============================================================

/** 全部审计动作，用于筛选下拉 */
export const AUDIT_ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'ARCHIVE',
  'INVITE',
  'JOIN',
  'LEAVE',
  'ASSIGN',
  'UNASSIGN',
  'ENABLE_2FA',
  'DISABLE_2FA',
  'REGENERATE_RECOVERY_CODES',
  'USE_RECOVERY_CODE',
]

/** 动作对应的 TDesign 标签主题：写操作按破坏性着色 */
export function auditActionTheme(
  action: AuditAction,
): 'success' | 'warning' | 'danger' | 'primary' | 'default' {
  switch (action) {
    case 'CREATE':
    case 'RESTORE':
    case 'JOIN':
      return 'success'
    case 'DELETE':
    case 'LEAVE':
    case 'DISABLE_2FA':
      return 'danger'
    case 'UPDATE':
    case 'ENABLE_2FA':
    case 'REGENERATE_RECOVERY_CODES':
    case 'USE_RECOVERY_CODE':
      return 'warning'
    case 'INVITE':
    case 'ASSIGN':
    case 'UNASSIGN':
    case 'ARCHIVE':
      return 'primary'
    default:
      return 'default'
  }
}

/** 快照里不参与差异比较的内部字段 */
const IGNORED_SNAPSHOT_KEYS = new Set(['updatedAt', 'createdAt'])

/** JSON 快照的可读文本：空值显示为占位符 */
export function formatSnapshot(value: Record<string, unknown> | null | undefined): string {
  if (value == null) return '—'
  if (!Object.keys(value).length) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** 单条字段差异 */
export interface AuditFieldChange {
  field: string
  before: string
  after: string
}

/** 差异值渲染：对象序列化，空值显示占位符 */
function renderValue(value: unknown): string {
  if (value === undefined) return '—'
  if (value === null) return '—'
  if (typeof value === 'string') return value || '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * before / after 的字段级差异。
 * CREATE 视为全部新增，DELETE 视为全部移除；比较时跳过时间戳字段。
 */
export function diffSnapshots(log: AuditLog): AuditFieldChange[] {
  const before = log.before ?? {}
  const after = log.after ?? {}
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])
  const changes: AuditFieldChange[] = []

  fields.forEach((field) => {
    if (IGNORED_SNAPSHOT_KEYS.has(field)) return
    const from = before[field]
    const to = after[field]
    const fromText = renderValue(from)
    const toText = renderValue(to)
    if (fromText === toText) return
    changes.push({ field, before: fromText, after: toText })
  })

  return changes.sort((a, b) => a.field.localeCompare(b.field))
}

/**
 * 审计条目的「实体」展示：项目维度的实体名后附实体 ID 短码。
 */
export function auditEntityLabel(log: AuditLog): string {
  return log.entity || '—'
}
