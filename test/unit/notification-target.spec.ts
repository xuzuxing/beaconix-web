import { describe, expect, it } from 'vitest'

import type { UserNotification } from '@/api/types/notification-center'
import en from '@/locales/notification.en-US'
import zh from '@/locales/notification.zh-CN'
import {
  notificationIconName,
  notificationLabelKey,
  notificationTheme,
  resolveNotificationTarget,
} from '@/utils/notification-presenter'

const notice = (patch: Partial<UserNotification> = {}): UserNotification => ({
  id: 'notification-1',
  userId: 'user-1',
  type: 'TICKET_REPLIED',
  title: 'New reply on your ticket',
  body: 'Support replied',
  isRead: false,
  readAt: null,
  resourceType: 'Ticket',
  resourceId: 'ticket-1',
  meta: null,
  createdAt: '2026-10-11T00:00:00.000Z',
  ...patch,
})

describe('resolveNotificationTarget · 工单', () => {
  it('提交者跳到自己的工单详情', () => {
    expect(resolveNotificationTarget(notice())).toEqual({
      kind: 'route',
      to: { path: '/tickets/ticket-1' },
    })
  })

  it('平台超管跳到管理后台，并按 ticketId 打开详情抽屉', () => {
    expect(resolveNotificationTarget(notice(), { isSuperAdmin: true })).toEqual({
      kind: 'route',
      to: { path: '/admin/tickets', query: { ticketId: 'ticket-1' } },
    })
  })

  it('缺 resourceId 时退回各自的列表页', () => {
    expect(resolveNotificationTarget(notice({ resourceId: null }))).toEqual({
      kind: 'route',
      to: { path: '/tickets' },
    })
    expect(
      resolveNotificationTarget(notice({ resourceId: null }), {
        isSuperAdmin: true,
      }),
    ).toEqual({ kind: 'route', to: { path: '/admin/tickets' } })
  })

  it('resourceType 的大小写与复数写法都认', () => {
    for (const resourceType of ['TICKET', 'ticket', 'Tickets', 'tickets']) {
      expect(resolveNotificationTarget(notice({ resourceType }))).toEqual({
        kind: 'route',
        to: { path: '/tickets/ticket-1' },
      })
    }
  })

  it('resourceId 会做 URL 编码', () => {
    expect(resolveNotificationTarget(notice({ resourceId: 'ticket/1' }))).toEqual({
      kind: 'route',
      to: { path: '/tickets/ticket%2F1' },
    })
  })
})

describe('工单通知的展示元数据', () => {
  const types = [
    'TICKET_CREATED',
    'TICKET_REPLIED',
    'TICKET_STATUS_CHANGED',
    'TICKET_ASSIGNED',
  ] as const

  it('四个类型共用「工单」标签、客服图标与合法主题', () => {
    for (const type of types) {
      expect(notificationLabelKey(type)).toBe('notificationCenter.type.ticket')
      expect(notificationIconName(type)).toBe('CustomerServiceIcon')
      expect(['primary', 'success', 'warning', 'danger', 'default']).toContain(
        notificationTheme(type),
      )
    }
  })

  it('中英文文案都已补齐', () => {
    expect(zh.type.ticket).toBe('工单')
    expect(en.type.ticket).toBe('Ticket')
  })
})
