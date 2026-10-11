import type { AxiosRequestConfig } from 'axios'

import type { Paginated } from '../types'
import type {
  NotificationReadAllResult,
  NotificationUnreadCount,
  UserNotification,
  UserNotificationQuery,
} from '../types/notification-center'
import { del, get, patch } from '@/utils/request'

/**
 * 站内通知（消息中心）。
 * 与 modules/notification.ts 区分：那支是组织级「通知渠道」的配置与投递日志，
 * 这里对应面向当前用户的事项列表（顶栏事项入口 / 通知列表页）。
 */

/** 当前用户的通知列表（分页，可按已读状态过滤） */
export function listUserNotifications(params?: UserNotificationQuery, config?: AxiosRequestConfig) {
  return get<Paginated<UserNotification>>(
    '/notifications',
    params as Record<string, unknown> | undefined,
    config,
  )
}

/** Current user's projected notification, independent of list pagination. */
export function getUserNotificationById(id: string, config?: AxiosRequestConfig) {
  return get<UserNotification>(`/notifications/${encodeURIComponent(id)}`, undefined, config)
}

/** 当前用户的未读数，用于顶栏角标与筛选计数 */
export function getUserNotificationUnreadCount(config?: AxiosRequestConfig) {
  return get<NotificationUnreadCount>('/notifications/unread-count', undefined, config)
}

/** 标记单条已读 */
export function markUserNotificationAsRead(id: string) {
  return patch<UserNotification>(`/notifications/${encodeURIComponent(id)}/read`)
}

/** 全部标记已读，返回被更新的条数 */
export function markAllUserNotificationsAsRead() {
  return patch<NotificationReadAllResult>('/notifications/read-all')
}

/** 删除（忽略）单条通知 */
export function deleteUserNotification(id: string) {
  return del<void>(`/notifications/${encodeURIComponent(id)}`)
}

/** Fetch supports JWT headers without putting credentials in an EventSource URL. */
export async function consumeNotificationStream(
  accessToken: string,
  signal: AbortSignal,
  receive: (notification: UserNotification) => void,
) {
  const base = (import.meta.env?.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
  const response = await fetch(`${base}/notifications/stream`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'text/event-stream' },
    signal,
  })
  if (!response.ok || !response.body) throw new Error('Notification stream unavailable')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let data: string[] = []
  function line(value: string) {
    if (value === '') {
      if (data.length) {
        try {
          const payload = JSON.parse(data.join('\n'))
          const item = payload?.data && !payload.id ? payload.data : payload
          if (
            typeof item?.id === 'string' &&
            typeof item?.userId === 'string' &&
            typeof item?.type === 'string' &&
            typeof item?.title === 'string' &&
            typeof item?.createdAt === 'string' &&
            typeof item?.isRead === 'boolean'
          )
            receive(item)
        } catch {
          // Ignore heartbeats and malformed frames; they must not affect counts.
        }
      }
      data = []
    } else if (value.startsWith('data:')) {
      data.push(value.slice(5).replace(/^ /, ''))
    }
  }
  try {
    while (!signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, newline).replace(/\r$/, ''))
        buffer = buffer.slice(newline + 1)
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
