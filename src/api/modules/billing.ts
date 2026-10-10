import type {
  CreateOrderParams,
  CreatePaymentParams,
  Order,
  Plan,
  QuotaSummary,
  SubscriptionStack,
  WechatPayParams,
} from '../types/billing'
import { get, post } from '@/utils/request'

/** 可购买的套餐目录（仅启用项，按 sortOrder 升序） */
export function listPlans() {
  return get<Plan[]>('/plans')
}

/** 套餐详情（未启用视同不存在） */
export function getPlan(id: string) {
  return get<Plan>(`/plans/${id}`)
}

/** 组织的订阅栈：生效套餐 + 叠加的订阅记录 */
export function getSubscriptionStack(orgId: string) {
  return get<SubscriptionStack>(`/organizations/${orgId}/subscription`)
}

/** 当前套餐的使用量 / 可用量摘要 */
export function getQuotaSummary(orgId: string) {
  return get<QuotaSummary>(`/organizations/${orgId}/quota`)
}

/** 创建购买订单（ADMIN+） */
export function createOrder(orgId: string, data: CreateOrderParams) {
  return post<Order>(`/organizations/${orgId}/orders`, data)
}

/** 组织订单列表（按创建时间倒序） */
export function listOrders(orgId: string) {
  return get<Order[]>(`/organizations/${orgId}/orders`)
}

/** 订单详情（需为该组织成员） */
export function getOrder(id: string) {
  return get<Order>(`/orders/${id}`)
}

/** 取消待支付订单 */
export function cancelOrder(id: string) {
  return post<Order>(`/orders/${id}/cancel`)
}

/** 创建订单支付，返回 wx.requestPayment 所需的签名参数 */
export function createOrderPayment(orderId: string, data: CreatePaymentParams) {
  return post<WechatPayParams>(`/orders/${orderId}/pay`, data)
}
