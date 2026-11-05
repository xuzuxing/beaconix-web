import type {
  AlipayPayMethod,
  AlipayPayParams,
  CreateOrderParams,
  CreatePaymentParams,
  MonitorCapacity,
  Order,
  OrderPaymentParams,
  Plan,
  QuotaSummary,
  SubscriptionStack,
  SelectMonitorCapacityParams,
  WechatVirtualPayParams,
} from '../types/billing'
import { get, patch, post } from '@/utils/request'

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

/** OWNER / ADMIN：读取降级周期和服务端计算的实际保留名单。 */
export function getMonitorCapacity(orgId: string) {
  return get<MonitorCapacity>(
    `/organizations/${encodeURIComponent(orgId)}/subscription/monitor-capacity`,
  )
}

export function selectMonitorCapacity(orgId: string, data: SelectMonitorCapacityParams) {
  return patch<MonitorCapacity>(
    `/organizations/${encodeURIComponent(orgId)}/subscription/monitor-capacity`,
    data,
  )
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

/**
 * 创建订单支付（按渠道返回不同结构）。
 *
 * - `WECHAT`：返回 `wx.requestPayment` 所需的 JSAPI 签名参数；
 * - `ALIPAY`：返回 Native 预下单的支付链接，前端据此生成二维码。
 *
 * 返回类型由调用方按渠道指定，避免在页面里做运行时收窄。
 */
export function createOrderPayment<T extends OrderPaymentParams = OrderPaymentParams>(
  orderId: string,
  data: CreatePaymentParams,
) {
  return post<T>(`/orders/${orderId}/pay`, data)
}

/**
 * 支付宝预下单（`channel=ALIPAY`）。
 *
 * 默认走 `alipay.trade.precreate`（扫码）：返回 `qrCode` 支付链接，交给二维码组件渲染；
 * 传 `alipay.trade.page.pay` / `alipay.trade.wap.pay` 时后端返回收银台 `payUrl`。
 */
export function createAlipayPayment(
  orderId: string,
  payMethod: AlipayPayMethod = 'alipay.trade.precreate',
) {
  return createOrderPayment<AlipayPayParams>(orderId, { channel: 'ALIPAY', payMethod })
}

/**
 * 微信小程序虚拟支付预下单（`channel=WECHAT_VIRTUAL`，仅小程序内可用）。
 *
 * `code` 必须来自当前会话的 `wx.login()`：服务端拿它换 session_key 计算用户签名，
 * 旧 code 不可复用。返回值直接喂给 `wx.requestVirtualPayment`。
 */
export function createWechatVirtualPayment(orderId: string, code: string) {
  return createOrderPayment<WechatVirtualPayParams>(orderId, {
    channel: 'WECHAT_VIRTUAL',
    code,
  })
}
