// ============================================================
// 站内通知（消息中心）
// 注意与 types/notification.ts 区分：后者是「通知渠道」的投递配置，
// 这里对应后端 /api/notifications —— 面向当前用户的事项列表。
// ============================================================

import type { InvitationStatus } from '../types'

export interface UserNotificationMeta extends Record<string, unknown> {
  invitationStatus?: InvitationStatus
  invitationExpiresAt?: string
  actionable?: boolean
  organizationId?: string
  projectId?: string
}

/** 通知类型，对应后端 NotificationEntity.type */
export type UserNotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_COMMENTED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED'
  | 'PROJECT_ARCHIVED'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'MENTION'
  | 'INVITATION_RECEIVED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_DECLINED'
  | 'INVITATION_REVOKED'
  | 'INVITATION_EXPIRED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_LEFT'
  | 'OWNERSHIP_TRANSFERRED'
  | 'ORGANIZATION_DELETED'
  | 'ORGANIZATION_RESTORED'
  | 'TASK_UNASSIGNED'
  | 'TASK_DELETED'
  | 'TASK_RESTORED'
  | 'TASK_SPRINT_CHANGED'
  | 'TASK_DEPENDENCY_CHANGED'
  | 'TASK_UNBLOCKED'
  | 'COMMENT_REPLIED'
  | 'PROJECT_DELETED'
  | 'PROJECT_RESTORED'
  | 'SPRINT_DELETED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'TWO_FACTOR_RECOVERY_CODE_USED'
  | 'TWO_FACTOR_RECOVERY_CODES_REGENERATED'
  | 'PAYMENT_SUCCEEDED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'MONITOR_CAPACITY_GRACE_STARTED'
  | 'MONITOR_CAPACITY_GRACE_ENDING'
  | 'MONITOR_CAPACITY_LIMITED'
  | 'MONITOR_CAPACITY_RESTORED'
  | 'MONITOR_ALERT'
  | 'MONITOR_RECOVERED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'PERSONAL_ACCESS_TOKEN_CREATED'
  | 'PERSONAL_ACCESS_TOKEN_REVOKED'
  | 'PROBE_ENROLLED'
  | 'PROBE_SECRET_ROTATED'
  | 'PROBE_CREDENTIAL_REVOKED'
  | 'TICKET_CREATED'
  | 'TICKET_REPLIED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_ASSIGNED'

/** Projected notification returned by both /notifications and /notifications/:id. */
export interface UserNotification {
  id: string
  userId: string
  type: UserNotificationType
  title: string
  /** 正文：后端 schema 标为 object，实际多为字符串，渲染前统一走 presenter 归一化 */
  body: unknown
  isRead: boolean
  readAt: string | null
  /** 关联资源类型，如 Task / Sprint / Project */
  resourceType: string | null
  /** 关联资源 ID */
  resourceId: string | null
  /** Projected state and workspace hints; arbitrary metadata URLs are never followed. */
  meta: UserNotificationMeta | null
  createdAt: string
}

/** 未读筛选：不传表示全部 */
export type NotificationReadFilter = 'all' | 'unread' | 'read'

/** 列表查询参数 */
export interface UserNotificationQuery {
  /** 省略表示不按已读状态过滤 */
  isRead?: boolean
  page?: number
  limit?: number
}

/** /api/notifications/unread-count */
export interface NotificationUnreadCount {
  count: number
}

/** /api/notifications/read-all */
export interface NotificationReadAllResult {
  updated: number
}
