/**
 * 计费（Billing）实体类型。
 * 对齐后端 PlanEntity / SubscriptionStackEntity / OrderEntity / QuotaService 的返回结构。
 */

/** 计费套餐（GET /plans） */
export interface Plan {
  id: string
  /** 套餐编码，如 FREE / PRO（创建订单时 FREE 不可购买） */
  code: string
  name: string
  description: string | null
  /** 价格，单位：分 */
  price: number
  /** 套餐默认时长（天） */
  durationDays: number
  sortOrder: number
  maxMonitors: number
  maxProbes: number
  maxMembers: number
  maxChannels: number
  /** 最小检测间隔（秒） */
  minInterval: number
  allowTenantProbe: boolean
  allowStatusPage: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** 订阅栈中的一条订阅记录 */
export interface SubscriptionStackEntry {
  id: string
  plan: Plan
  expiresAt: string
  /** 是否为当前生效（栈顶未过期）的订阅 */
  isEffective: boolean
}

/** 组织订阅栈：生效套餐 + 叠加的订阅记录（GET /organizations/{orgId}/subscription） */
export interface SubscriptionStack {
  /** 无任何生效订阅时为 null（等同免费版兜底） */
  effectivePlan: Plan | null
  stack: SubscriptionStackEntry[]
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'

/** 购买订单 */
export interface Order {
  id: string
  orderNo: string
  organizationId: string
  planId: string
  userId: string
  /** 金额，单位：分 */
  amount: number
  currency: string
  durationDays: number
  status: OrderStatus
  paidAt: string | null
  cancelledAt: string | null
  /** 待支付订单的过期时间（创建后 30 分钟） */
  expiresAt: string
  createdAt: string
  updatedAt: string
  plan?: Plan | null
}

export interface CreateOrderParams {
  planId: string
  /** 购买时长（天），缺省取套餐默认时长 */
  durationDays?: number
}

/** 支付渠道，新渠道由后端工厂扩展 */
export type PaymentChannel = 'WECHAT'

export interface CreatePaymentParams {
  /** 渠道侧付款人标识，微信为 openid */
  openid: string
  channel?: PaymentChannel
}

/** wx.requestPayment 所需的微信 JSAPI 签名参数 */
export interface WechatPayParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

/** 配额受管资源 */
export type QuotaResourceKey = 'monitors' | 'probes' | 'members' | 'channels' | 'apiKeys'

/** 单项配额用量（GET /organizations/{orgId}/quota） */
export interface QuotaUsage {
  used: number
  limit: number
  /** 使用百分比，0-100（limit 为 0 时固定 0） */
  percent: number
}

/** 当前套餐用量摘要 */
export interface QuotaSummary {
  plan: {
    code: string
    name: string
    /** 价格，单位：分 */
    price: number
  }
  resources: Record<QuotaResourceKey, QuotaUsage>
  features: {
    allowTenantProbe: boolean
    allowStatusPage: boolean
  }
  /** 当前套餐的最小检测间隔（秒） */
  minInterval: number
}
