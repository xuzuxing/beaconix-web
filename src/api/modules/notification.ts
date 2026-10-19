import type { AxiosRequestConfig } from 'axios'

import type { Paginated } from '../types'
import type {
  ChannelLogQuery,
  ChannelTestResult,
  CreateNotificationChannelParams,
  NotificationChannel,
  NotificationLog,
  UpdateNotificationChannelParams,
} from '../types/notification'
import { del, get, patch, post } from '@/utils/request'

/** 组织下的通知渠道列表 */
export function listNotificationChannels(orgId: string, config?: AxiosRequestConfig) {
  return get<NotificationChannel[]>(
    `/organizations/${encodeURIComponent(orgId)}/notification-channels`,
    undefined,
    config,
  )
}

export function createNotificationChannel(orgId: string, data: CreateNotificationChannelParams) {
  return post<NotificationChannel>(
    `/organizations/${encodeURIComponent(orgId)}/notification-channels`,
    data,
  )
}

export function getNotificationChannel(orgId: string, id: string, config?: AxiosRequestConfig) {
  return get<NotificationChannel>(
    `/organizations/${encodeURIComponent(orgId)}/notification-channels/${encodeURIComponent(id)}`,
    undefined,
    config,
  )
}

export function updateNotificationChannel(
  orgId: string,
  id: string,
  data: UpdateNotificationChannelParams,
) {
  return patch<NotificationChannel>(
    `/organizations/${encodeURIComponent(orgId)}/notification-channels/${encodeURIComponent(id)}`,
    data,
  )
}

export function deleteNotificationChannel(orgId: string, id: string) {
  return del<void>(
    `/organizations/${encodeURIComponent(orgId)}/notification-channels/${encodeURIComponent(id)}`,
  )
}

/** 向该渠道发送一条测试消息 */
export function testNotificationChannel(orgId: string, id: string) {
  return post<ChannelTestResult>(
    `/organizations/${encodeURIComponent(orgId)}/notification-channels/${encodeURIComponent(id)}/test`,
  )
}

/** 渠道的投递日志（分页） */
export function listNotificationChannelLogs(
  orgId: string,
  id: string,
  params?: ChannelLogQuery,
  config?: AxiosRequestConfig,
) {
  return get<Paginated<NotificationLog>>(
    `/organizations/${encodeURIComponent(orgId)}/notification-channels/${encodeURIComponent(id)}/logs`,
    params as Record<string, unknown> | undefined,
    config,
  )
}
