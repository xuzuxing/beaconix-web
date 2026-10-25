import type { CreateRefundParams, Refund, RefundQuote } from '../types/refund'
import { get, post } from '@/utils/request'

/**
 * 用户端退款接口（订单所属组织的成员可读，提交需 ADMIN+）。
 *
 * 金额一律由服务端按政策计算：前端只调试算拿结果，不参与折算。
 */

/** 退款试算（只读）：能退多少、命中哪条政策、退款后订阅会怎样 */
export function getOrderRefundQuote(orderId: string) {
  return get<RefundQuote>(`/orders/${encodeURIComponent(orderId)}/refund-quote`)
}

/** 提交退款申请（ADMIN+）；金额不可传，由后端计算 */
export function createOrderRefund(orderId: string, data: CreateRefundParams = {}) {
  return post<Refund>(`/orders/${encodeURIComponent(orderId)}/refunds`, data)
}

/** 订单的退款单列表（按 createdAt 倒序，一单一退通常只有 1 条） */
export function listOrderRefunds(orderId: string) {
  return get<Refund[]>(`/orders/${encodeURIComponent(orderId)}/refunds`)
}
