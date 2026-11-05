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
  /**
   * 微信小程序虚拟支付的商品 ID（微信侧配置的「道具/商品」标识）。
   * 为空表示该周期不支持小程序内支付；Web 端只做展示与配置，不参与支付。
   */
  wechatProductId?: string | null
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

/** 订阅记录的可用状态（`ACTIVE` 才是当前生效的那条） */
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED'

/** 订阅栈中的一条订阅记录 */
export interface SubscriptionStackEntry {
  id: string
  plan: Plan
  /** 生效起点；在未来表示「排队中」（降级或平级续购排到当前套餐结束后） */
  startsAt: string
  /** 到期时间；`PAUSED` 条目这里是冻结时记下的旧值，展示请用 `pausedRemainingDays` */
  expiresAt: string
  status: SubscriptionStatus
  /** `PAUSED` 条目的冻结天数；`ACTIVE` 条目为 null */
  pausedRemainingDays?: number | null
  /** 是否为当前生效（栈顶未过期）的订阅 */
  isEffective: boolean
}

/** 组织订阅栈：生效套餐 + 叠加的订阅记录（GET /organizations/{orgId}/subscription） */
export interface SubscriptionStack {
  /** 无任何生效订阅时为 null（等同免费版兜底） */
  effectivePlan: Plan | null
  stack: SubscriptionStackEntry[]
}

/** 数量限制独立于 enabled；连续降级可能有多个截止批次。 */
export interface MonitorCapacity {
  cycleId: string | null
  status: 'WITHIN_LIMIT' | 'GRACE' | 'LIMITED'
  startsAt: string | null
  graceEndsAt: string | null
  limit: number
  total: number
  overLimit: boolean
  excess: number
  selectedMonitorIds: string[]
  retainedMonitorIds: string[]
  restrictedMonitorIds: string[]
  monitorDeadlines: Array<{ id: string; quotaGraceEndsAt: string; enabled: boolean }>
}

export interface SelectMonitorCapacityParams {
  cycleId: string
  monitorIds: string[]
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

/**
 * 支付渠道（api-5 `CreatePaymentDto.channel`）。
 *
 * - `WECHAT`：JSAPI，Web/微信内置浏览器用 `wx.requestPayment`；
 * - `WECHAT_VIRTUAL`：小程序虚拟支付，仅小程序内用 `wx.requestVirtualPayment`；
 * - `ALIPAY`：支付宝，按 `payMethod` 返回收银台链接或扫码支付链接。
 */
export type PaymentChannel = 'WECHAT' | 'WECHAT_VIRTUAL' | 'ALIPAY'

/**
 * 支付宝产品码（`CreatePaymentDto.payMethod`，仅 `ALIPAY` 渠道使用）。
 *
 * - `alipay.trade.page.pay`：PC 收银台（默认），返回可 GET 跳转的 `payUrl`；
 * - `alipay.trade.wap.pay`：手机浏览器收银台，返回 `payUrl`；
 * - `alipay.trade.precreate`：扫码支付，返回供本地渲染二维码的 `qrCode`。
 */
export type AlipayPayMethod =
  'alipay.trade.page.pay' | 'alipay.trade.wap.pay' | 'alipay.trade.precreate'

export interface CreatePaymentParams {
  channel: PaymentChannel
  /** 渠道侧付款人标识：仅 `WECHAT` 需要（openid） */
  openid?: string
  /** `WECHAT_VIRTUAL` 必填：`wx.login()` 的一次性 code（服务端换 session_key 算用户签名） */
  code?: string
  /** 仅 `ALIPAY`：决定返回 `payUrl` 还是扫码用的 `qrCode` */
  payMethod?: AlipayPayMethod
}

/** wx.requestPayment 所需的微信 JSAPI 签名参数 */
export interface WechatPayParams {
  channel?: 'WECHAT'
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

/**
 * 微信小程序虚拟支付（`wx.requestVirtualPayment`）参数。
 *
 * 服务端用 `wx.login()` 的 code 换到 session_key 后计算用户签名，
 * 因此每次支付都必须重新取 code，不能缓存。
 */
export interface WechatVirtualPayParams {
  channel: 'WECHAT_VIRTUAL'
  /** 支付参数 JSON 字符串，直接作为 `signData` 传入 */
  signData: string
  /** 道具/支付签名 */
  paySig: string
  /** 用户态签名 */
  signature: string
}

/**
 * 支付宝支付参数。
 *
 * `payMethod` 决定返回哪个字段：
 * - `alipay.trade.precreate` → `qrCode`（支付链接，前端用它渲染二维码）；
 * - `alipay.trade.page.pay` / `alipay.trade.wap.pay` → `payUrl`（收银台跳转链接）。
 */
export interface AlipayPayParams {
  channel: 'ALIPAY'
  /** 扫码支付的支付链接，形如 https://qr.alipay.com/bax0xxxxxxxx */
  qrCode?: string
  /** 电脑/手机网站收银台链接，可直接 GET 跳转 */
  payUrl?: string
  /** 支付宝侧交易号，便于排查问题时对账 */
  tradeNo?: string
}

/** 下单支付接口的返回：按渠道区分微信签名参数与支付宝支付链接 */
export type OrderPaymentParams = WechatPayParams | WechatVirtualPayParams | AlipayPayParams

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
