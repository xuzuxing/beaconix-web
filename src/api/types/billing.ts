/**
 * 计费（Billing）实体类型。
 * 对齐后端 PlanEntity / SubscriptionStackEntity / OrderEntity / QuotaService 的返回结构。
 */

import type { MonitorType } from '../types'

/** 计费周期档位（后端 `PlanCycle` 枚举） */
export type PlanCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

/** 套餐的单个计费周期档位（PlanTermEntity） */
export interface PlanTerm {
  id: string
  planId: string
  cycle: PlanCycle
  /** 该档位的时长（天），下单时快照到订单 */
  durationDays: number
  /** 该档位的价格，单位：分 */
  price: number
  /** 停用后不能再被购买 */
  enabled: boolean
  sortOrder: number
}

/**
 * 计费套餐（GET /plans）。
 *
 * 一个套餐有多个计费周期档位，各档独立定价；`price` / `durationDays` 是
 * **最便宜启用档的镜像**（列表页「¥29 起」用），真源是 `terms`。
 *
 * 新增字段（`terms` / `allowedMonitorTypes` / `maxProbesPerMonitor` / `maxApiKeys`）
 * 在套餐目录接口（`GET /plans`、`GET /admin/plans`）必然返回；订阅栈接口
 * （`GET /organizations/{orgId}/subscription`）不 include 这些字段，因此声明为可选，
 * 消费端需自行兜底。
 */
export interface Plan {
  id: string
  /** 套餐编码，如 FREE / PRO（创建订单时 FREE 不可购买） */
  code: string
  name: string
  description: string | null
  /** 最便宜启用档的价格，单位：分 */
  price: number
  /** 最便宜启用档的时长（天） */
  durationDays: number
  sortOrder: number
  maxMonitors: number
  maxProbes: number
  /** 单个监控项可挂的探针数上限，0 表示不可手动挂载 */
  maxProbesPerMonitor?: number
  /** 0 表示不能创建任何 API Key */
  maxApiKeys?: number
  maxMembers: number
  maxChannels: number
  /** 最小检测间隔（秒） */
  minInterval: number
  allowTenantProbe: boolean
  allowStatusPage: boolean
  /** 允许创建的监控协议；空数组表示禁止创建任何监控 */
  allowedMonitorTypes?: MonitorType[]
  enabled: boolean
  createdAt: string
  updatedAt: string
  /** 可购买的计费周期档位，已按 sortOrder 升序且只含启用档；可能只有一档 */
  terms?: PlanTerm[]
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
  /** 下单时所选周期档位 */
  cycle: PlanCycle
  /** 下单时所选档位 ID */
  termId: string
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
  /** 购买的计费周期；省略时后端取最便宜启用档。金额与时长由后端按档位决定 */
  cycle?: PlanCycle
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
  /** 上限；**0 表示该资源不可用**（不是「不限」） */
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
  /** 允许创建的监控协议；空数组表示禁止创建任何监控 */
  allowedMonitorTypes?: MonitorType[]
  /** 单个监控项可挂的探针数上限，0 表示不可手动挂载 */
  maxProbesPerMonitor?: number
}
