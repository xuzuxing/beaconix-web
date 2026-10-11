import type { AxiosRequestConfig } from 'axios'

import type { AdminOrder, AdminOrderPage, AdminOrderQuery } from '../types/admin'
import { get, post } from '@/utils/request'

/**
 * 管理后台 · 跨租户订单（仅 SUPER_ADMIN）。
 *
 * 运营操作只改订单状态，不触碰订阅与通知：
 * - cancel     PENDING → CANCELLED
 * - markPaid   PENDING → PAID（人工 / 线下补单）
 * - refund     PAID → REFUNDED（只记账，不调用支付渠道退款）
 */

/** 全平台订单列表（分页 + 可选筛选） */
export function listAdminOrders(params?: AdminOrderQuery, config?: AxiosRequestConfig) {
  return get<AdminOrderPage>(
    '/admin/orders',
    params as Record<string, unknown> | undefined,
    config,
  )
}

/** 订单详情 */
export function getAdminOrder(id: string) {
  return get<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}`)
}

/** 取消待支付订单 */
export function cancelAdminOrder(id: string) {
  return post<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}/cancel`)
}

/** 把待支付订单标记为已支付（人工补单） */
export function markAdminOrderPaid(id: string) {
  return post<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}/mark-paid`)
}

/** 把已支付订单标记为已退款 */
export function refundAdminOrder(id: string) {
  return post<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}/refund`)
}
