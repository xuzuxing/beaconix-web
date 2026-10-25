import type {
  AdminRefund,
  AdminRefundPage,
  AdminRefundQuery,
  AdminRefundQuote,
  AdminRefundStats,
  AdminRefundStatsQuery,
  CloseAdminRefundParams,
  CreateAdminRefundParams,
} from '../types/refund'
import { get, post } from '@/utils/request'

/**
 * 管理后台 · 退款（仅 SUPER_ADMIN，跨租户）。
 *
 * 与「订单 → 标记已退款」不同：这里的操作会真实调用支付渠道退款，
 * 并驱动退款单的状态机（PENDING → PROCESSING → SUCCESS / FAILED / CLOSED）。
 */

/** 全平台退款单列表（分页 + 可选筛选） */
export function listAdminRefunds(params?: AdminRefundQuery) {
  return get<AdminRefundPage>('/admin/refunds', params as Record<string, unknown> | undefined)
}

/** 某订单的退款试算，额外带退款总开关状态 */
export function getAdminRefundQuote(orderId: string) {
  return get<AdminRefundQuote>(`/admin/refunds/quote/${encodeURIComponent(orderId)}`)
}

/** 后台发起退款：直接提交渠道，不走审批 */
export function createAdminRefund(data: CreateAdminRefundParams) {
  return post<AdminRefund>('/admin/refunds', data)
}

/** 审批通过：PENDING → 提交渠道 */
export function approveAdminRefund(id: string) {
  return post<AdminRefund>(`/admin/refunds/${encodeURIComponent(id)}/approve`)
}

/** 重试：FAILED → 用同一退款单号重新提交（渠道幂等） */
export function retryAdminRefund(id: string) {
  return post<AdminRefund>(`/admin/refunds/${encodeURIComponent(id)}/retry`)
}

/** 人工关闭：PENDING / PROCESSING / FAILED 都可关闭 */
export function closeAdminRefund(id: string, data: CloseAdminRefundParams = {}) {
  return post<AdminRefund>(`/admin/refunds/${encodeURIComponent(id)}/close`, data)
}

/** 对账统计：金额合计、按状态/渠道/政策聚合与失败原因 Top 20 */
export function getAdminRefundStats(params?: AdminRefundStatsQuery) {
  return get<AdminRefundStats>(
    '/admin/refunds/stats',
    params as Record<string, unknown> | undefined,
  )
}
