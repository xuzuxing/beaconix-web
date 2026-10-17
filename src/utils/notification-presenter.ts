import dayjs from 'dayjs'
import type { RouteLocationRaw } from 'vue-router'

import type { InvitationStatus } from '@/api/types'
import type { UserInvitation } from '@/api/types/invitation'
import type {
  NotificationReadFilter,
  UserNotification,
  UserNotificationType,
} from '@/api/types/notification-center'

/** t-tag 支持的主题，也是卡片左侧色条的取色依据 */
export type NotificationTheme = 'primary' | 'success' | 'warning' | 'danger' | 'default'

interface NotificationTypeMeta {
  /** i18n 后缀：notificationCenter.type.<key> */
  key: string
  theme: NotificationTheme
}

/**
 * 通知类型 → 展示分组。
 * Events are grouped by domain, preserving the existing compact labels.
 */
const TYPE_META: Record<UserNotificationType, NotificationTypeMeta> = {
  TASK_ASSIGNED: { key: 'task', theme: 'primary' },
  TASK_UPDATED: { key: 'task', theme: 'primary' },
  TASK_COMMENTED: { key: 'task', theme: 'primary' },
  TASK_STATUS_CHANGED: { key: 'task', theme: 'primary' },
  TASK_DUE_SOON: { key: 'task', theme: 'warning' },
  TASK_OVERDUE: { key: 'task', theme: 'danger' },
  SPRINT_STARTED: { key: 'sprint', theme: 'success' },
  SPRINT_COMPLETED: { key: 'sprint', theme: 'success' },
  PROJECT_ARCHIVED: { key: 'project', theme: 'warning' },
  MEMBER_JOINED: { key: 'member', theme: 'success' },
  MEMBER_REMOVED: { key: 'member', theme: 'warning' },
  MENTION: { key: 'mention', theme: 'danger' },
  INVITATION_RECEIVED: { key: 'invitation', theme: 'primary' },
  INVITATION_ACCEPTED: { key: 'invitation', theme: 'success' },
  INVITATION_DECLINED: { key: 'invitation', theme: 'default' },
  INVITATION_REVOKED: { key: 'invitation', theme: 'warning' },
  INVITATION_EXPIRED: { key: 'invitation', theme: 'warning' },
  MEMBER_ROLE_CHANGED: { key: 'member', theme: 'primary' },
  MEMBER_LEFT: { key: 'member', theme: 'warning' },
  OWNERSHIP_TRANSFERRED: { key: 'organization', theme: 'primary' },
  ORGANIZATION_DELETED: { key: 'organization', theme: 'danger' },
  ORGANIZATION_RESTORED: { key: 'organization', theme: 'success' },
  TASK_UNASSIGNED: { key: 'task', theme: 'warning' },
  TASK_DELETED: { key: 'task', theme: 'danger' },
  TASK_RESTORED: { key: 'task', theme: 'success' },
  TASK_SPRINT_CHANGED: { key: 'task', theme: 'primary' },
  TASK_DEPENDENCY_CHANGED: { key: 'task', theme: 'primary' },
  TASK_UNBLOCKED: { key: 'task', theme: 'success' },
  COMMENT_REPLIED: { key: 'comment', theme: 'primary' },
  PROJECT_DELETED: { key: 'project', theme: 'danger' },
  PROJECT_RESTORED: { key: 'project', theme: 'success' },
  SPRINT_DELETED: { key: 'sprint', theme: 'danger' },
  PASSWORD_CHANGED: { key: 'security', theme: 'primary' },
  PASSWORD_RESET_COMPLETED: { key: 'security', theme: 'success' },
  TWO_FACTOR_ENABLED: { key: 'security', theme: 'success' },
  TWO_FACTOR_DISABLED: { key: 'security', theme: 'warning' },
  TWO_FACTOR_RECOVERY_CODE_USED: { key: 'security', theme: 'warning' },
  TWO_FACTOR_RECOVERY_CODES_REGENERATED: { key: 'security', theme: 'primary' },
  PAYMENT_SUCCEEDED: { key: 'billing', theme: 'success' },
  SUBSCRIPTION_ACTIVATED: { key: 'billing', theme: 'success' },
  SUBSCRIPTION_RENEWED: { key: 'billing', theme: 'success' },
  SUBSCRIPTION_EXPIRING: { key: 'billing', theme: 'warning' },
  SUBSCRIPTION_EXPIRED: { key: 'billing', theme: 'danger' },
  MONITOR_ALERT: { key: 'monitor', theme: 'danger' },
  MONITOR_RECOVERED: { key: 'monitor', theme: 'success' },
  API_KEY_CREATED: { key: 'credential', theme: 'primary' },
  API_KEY_REVOKED: { key: 'credential', theme: 'warning' },
  PERSONAL_ACCESS_TOKEN_CREATED: { key: 'credential', theme: 'primary' },
  PERSONAL_ACCESS_TOKEN_REVOKED: { key: 'credential', theme: 'warning' },
  PROBE_ENROLLED: { key: 'probe', theme: 'success' },
  PROBE_SECRET_ROTATED: { key: 'probe', theme: 'primary' },
  PROBE_CREDENTIAL_REVOKED: { key: 'probe', theme: 'warning' },
  TICKET_CREATED: { key: 'ticket', theme: 'primary' },
  TICKET_REPLIED: { key: 'ticket', theme: 'primary' },
  TICKET_STATUS_CHANGED: { key: 'ticket', theme: 'success' },
  TICKET_ASSIGNED: { key: 'ticket', theme: 'warning' },
}

const FALLBACK_META: NotificationTypeMeta = { key: 'other', theme: 'default' }

/** Icon names use the application's existing Hugeicons export set. */
export function notificationIconName(type: UserNotificationType | string) {
  const category = (TYPE_META[type as UserNotificationType] ?? FALLBACK_META).key
  const icons: Record<string, string> = {
    task: 'KanbanIcon',
    sprint: 'Calendar03Icon',
    project: 'Folder01Icon',
    member: 'UserIcon',
    mention: 'Mail01Icon',
    invitation: 'Mail01Icon',
    organization: 'TeamWorkIcon',
    comment: 'Mail01Icon',
    security: 'SecurityCheckIcon',
    billing: 'Invoice01Icon',
    monitor: 'Analytics01Icon',
    credential: 'ApiIcon',
    probe: 'ServerIcon',
    ticket: 'CustomerServiceIcon',
  }
  return icons[category] ?? 'Notification03Icon'
}

/** 类型标签的 i18n key */
export function notificationLabelKey(type: UserNotificationType | string) {
  const meta = TYPE_META[type as UserNotificationType] ?? FALLBACK_META
  return `notificationCenter.type.${meta.key}`
}

/** 类型标签主题（同时决定卡片左侧色条颜色） */
export function notificationTheme(type: UserNotificationType | string): NotificationTheme {
  return (TYPE_META[type as UserNotificationType] ?? FALLBACK_META).theme
}

/**
 * 归一化通知正文。
 * 后端 body 声明为 object，实际既可能是字符串也可能是结构化对象，这里统一取可读文本。
 */
export function notificationBodyText(body: unknown): string {
  if (typeof body === 'string') return body
  if (body == null) return ''
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>
    for (const key of ['text', 'content', 'message', 'description', 'title', 'body']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value
    }
    return ''
  }
  if (typeof body === 'number' || typeof body === 'boolean') return String(body)
  return ''
}

/** 事项时间：抽屉里按天（如图 2026/10/04），列表与详情带时分 */
export function formatNotificationTime(value: string | null | undefined, withTime = false) {
  if (!value) return '-'
  const parsed = dayjs(value)
  if (!parsed.isValid()) return value
  return parsed.format(withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY/MM/DD')
}

/** Only supported internal routes are exposed as notification destinations. */
export type NotificationTarget = { kind: 'route'; to: RouteLocationRaw }

export interface NotificationTargetOptions {
  /**
   * 当前用户是平台超管：工单类通知跳管理后台列表并按 id 打开详情抽屉。
   * 工单是账号级资源，`GET /tickets/:id` 只返回自己的工单，超管拿不到别人的。
   */
  isSuperAdmin?: boolean
}

/** 关联资源类型 → 现有页面；没有对应页面的资源（任务 / 迭代 / 项目）不出现入口 */
const RESOURCE_ROUTES: Record<string, RouteLocationRaw> = {
  ORGANIZATION: '/teams',
  MONITOR: '/monitor',
  RULE_GROUP: '/monitor/rule-groups',
  NOTIFICATION_CHANNEL: '/channels',
  APIKEY: '/teams/api-keys',
  API_KEY: '/teams/api-keys',
  PERSONALACCESSTOKEN: '/access-tokens',
  PERSONAL_ACCESS_TOKEN: '/access-tokens',
  PROBE: '/probes',
  USER: '/security',
  ORDER: '/billing/orders',
  SUBSCRIPTION: '/billing',
}

export function notificationScope(notification: UserNotification) {
  const read = (key: string) => {
    const value = notification.meta?.[key]
    return typeof value === 'string' && /^[\w-]+$/.test(value) ? value : undefined
  }
  return { organizationId: read('organizationId'), projectId: read('projectId') }
}

/**
 * 解析「立即处理」的去处：
 * Only known internal destinations are allowed; metadata URLs are not trusted.
 */
export function resolveNotificationTarget(
  notification: UserNotification,
  options: NotificationTargetOptions = {},
): NotificationTarget | null {
  const resourceType = notification.resourceType?.toUpperCase()
  if (notification.type.startsWith('INVITATION_'))
    return notification.type === 'INVITATION_RECEIVED'
      ? null
      : { kind: 'route', to: '/teams/members' }
  if (notification.type === 'ORGANIZATION_DELETED') return null
  if (notification.type === 'MEMBER_REMOVED' || notification.type === 'MEMBER_LEFT') return null
  const category = (TYPE_META[notification.type] ?? FALLBACK_META).key
  if (category === 'security') return { kind: 'route', to: '/security' }
  if (category === 'billing') {
    return { kind: 'route', to: resourceType === 'ORDER' ? '/billing/orders' : '/billing' }
  }
  if (!resourceType) return null

  // 工单：提交者进自己的工单详情，平台运营进管理后台列表（页面按 ticketId 打开抽屉）
  if (resourceType === 'TICKET' || resourceType === 'TICKETS') {
    const ticketId = notification.resourceId
    if (options.isSuperAdmin) {
      return {
        kind: 'route',
        to: ticketId
          ? { path: '/admin/tickets', query: { ticketId } }
          : { path: '/admin/tickets' },
      }
    }
    return {
      kind: 'route',
      to: ticketId
        ? { path: `/tickets/${encodeURIComponent(ticketId)}` }
        : { path: '/tickets' },
    }
  }

  const to = RESOURCE_ROUTES[resourceType]
  if (!to) return null
  if (resourceType === 'MONITOR' && notification.resourceId) {
    const scope = notificationScope(notification)
    return {
      kind: 'route',
      to: scope.projectId
        ? {
            name: 'monitor-detail',
            params: { projectId: scope.projectId, monitorId: notification.resourceId },
            query: { highlight: notification.resourceId, ...scope },
          }
        : { path: '/monitor', query: { highlight: notification.resourceId, ...scope } },
    }
  }
  return { kind: 'route', to }
}

const INVITATION_STATUSES: InvitationStatus[] = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'REVOKED',
]

export function notificationInvitationId(notification: UserNotification) {
  if (!notification.type.startsWith('INVITATION_')) return null
  if (notification.resourceType?.toUpperCase() !== 'INVITATION') return null
  return notification.resourceId || null
}

/** By-ID lookup is invitee-only; admin transition notices use projected status. */
export function notificationReceivedInvitationId(notification: UserNotification) {
  return notification.type === 'INVITATION_RECEIVED' ? notificationInvitationId(notification) : null
}

export function notificationInvitationStatus(
  notification: UserNotification,
  invitation?: UserInvitation,
  now = Date.now(),
): InvitationStatus | undefined {
  const projected = notification.meta?.invitationStatus
  const eventStatus = notification.type.replace('INVITATION_', '')
  const value = invitation?.status ?? projected ?? eventStatus
  if (!INVITATION_STATUSES.includes(value as InvitationStatus)) return undefined
  const expiresAt = invitation?.expiresAt ?? notification.meta?.invitationExpiresAt
  if (value === 'PENDING' && typeof expiresAt === 'string' && Date.parse(expiresAt) <= now)
    return 'EXPIRED'
  return value as InvitationStatus
}

export function canActOnInvitation(
  notification: UserNotification,
  invitation?: UserInvitation,
  now = Date.now(),
) {
  const expiresAt = invitation?.expiresAt ?? notification.meta?.invitationExpiresAt
  return Boolean(
    notificationInvitationId(notification) &&
    notification.type === 'INVITATION_RECEIVED' &&
    notification.meta?.actionable === true &&
    notificationInvitationStatus(notification, invitation, now) === 'PENDING' &&
    typeof expiresAt === 'string' &&
    Date.parse(expiresAt) > now,
  )
}

/** Render an explicit allowlist, never raw token/credential metadata. */
export function notificationMetaRows(meta: UserNotification['meta']) {
  if (!meta) return []
  return [
    'organizationId',
    'projectId',
    'organizationName',
    'projectName',
    'role',
    'previousRole',
    'monitorName',
  ].flatMap((key) => {
    const value = meta[key]
    return typeof value === 'string' || typeof value === 'number'
      ? [{ key, value: String(value) }]
      : []
  })
}

export function pendingInvitationNotification(invitation: UserInvitation): UserNotification {
  return {
    id: `pending-invitation:${invitation.id}`,
    userId: '',
    type: 'INVITATION_RECEIVED',
    title: invitation.organization?.name ?? invitation.organizationId,
    body: invitation.sentBy?.name ?? '',
    isRead: true,
    readAt: null,
    resourceType: 'Invitation',
    resourceId: invitation.id,
    meta: {
      invitationStatus: invitation.status,
      invitationExpiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      actionable: true,
    },
    createdAt: invitation.createdAt,
  }
}

/** 筛选器取值 → 列表接口的 isRead 参数 */
export function notificationReadParam(filter: NotificationReadFilter) {
  if (filter === 'unread') return false
  if (filter === 'read') return true
  return undefined
}
