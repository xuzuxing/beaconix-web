/**
 * 退款（Refund）实体类型。
 *
 * 对齐 nest-beacon 的 `src/modules/billing/refund/`（用户端）与
 * `src/modules/admin/refunds/`（管理端）返回结构，契约见 `docs/refund-web-integration.md`。
 * 所有金额字段单位都是**分**，时间字段是 ISO 8601 字符串。
 */

import type { PaymentChannel } from './billing'

/**
 * 退款算法。
 * - `FULL`：全额（未开始 / 冷静期内）
 * - `PRORATED`：按未使用天数折算
 * - `MANUAL`：后台人工指定金额（仅管理端）
 */
export type RefundType = 'FULL' | 'PRORATED' | 'MANUAL'

/**
 * 退款单状态机：`PENDING` 待审批 → `PROCESSING` 已提交渠道 → `SUCCESS` / `FAILED`；
 * `PENDING` / `PROCESSING` / `FAILED` 都可被人工关闭为 `CLOSED`。
 */
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CLOSED'

/** 命中的退款政策（`RefundQuote.policyCode`） */
export type RefundPolicyCode =
  | 'NOT_STARTED'
  | 'COOLING_OFF'
  | 'PRORATED'
  | 'EXPIRED'
  | 'NON_REFUNDABLE'
  | 'ALREADY_REFUNDED'
  | 'MANUAL'

/**
 * 退款对订阅的影响，确认弹窗必须展示：
 * - `CANCEL_PENDING`：作废尚未开始的排队订阅段
 * - `EXPIRE_NOW`：订阅立即到期
 * - `SHRINK`：续费订单，有效期扣掉未使用天数
 * - `NONE`：不动权益（不可退场景）
 */
export type SubscriptionEffect = 'CANCEL_PENDING' | 'EXPIRE_NOW' | 'SHRINK' | 'NONE'

/**
 * 退款试算（`GET /orders/:id/refund-quote`）。
 *
 * 金额由服务端按政策计算，前端只展示；`reason` 仅在不可退时有值（英文，可直接展示）。
 */
export interface RefundQuote {
  /** 当前是否可退 */
  eligible: boolean
  /** 命中的政策 */
  policyCode: RefundPolicyCode
  /** 本应采用的退款算法 */
  type: RefundType
  /** 已使用天数 */
  usedDays: number
  /** 未使用天数 */
  remainingDays: number
  /** 实际可退（分，已扣手续费、已受上限约束） */
  amount: number
  /** 折算原始金额（分，未扣手续费） */
  grossAmount: number
  /** 手续费（分） */
  feeAmount: number
  /** 订单金额 - 已退金额（分） */
  maxRefundable: number
  /** 退款对订阅的影响 */
  subscriptionEffect: SubscriptionEffect
  /** 后台是否开放了用户自助退款；false 时只展示客服入口 */
  selfServiceEnabled: boolean
  /** 不可退时的英文原因 */
  reason: string | null
}

/** 用户端可见的退款单（裁剪视图：不含渠道报文与审批人） */
export interface Refund {
  id: string
  refundNo: string
  status: RefundStatus
  type: RefundType
  /** 申请退款金额（分） */
  amount: number
  /** 渠道实际退款金额（分），成功后有值 */
  settledAmount: number | null
  policyCode: RefundPolicyCode
  usedDays: number
  remainingDays: number
  /** 申请人填写的理由 */
  reason: string | null
  /** 失败原因（`status === 'FAILED'` 时有值） */
  failureReason: string | null
  /** 退款成功时间 */
  refundedAt: string | null
  createdAt: string
}

/** 提交退款申请（`POST /orders/:id/refunds`）：金额由服务端计算，前端不能传 */
export interface CreateRefundParams {
  /** 可选理由，最长 200 字符 */
  reason?: string
}

// ------------------------------------------------------------
// 管理端（/admin/refunds）
// ------------------------------------------------------------

/** 管理端退款单：在用户端视图之上补齐渠道、审批人与时间戳 */
export interface AdminRefund extends Refund {
  orderId: string
  orderNo: string
  organizationId: string
  channel: PaymentChannel
  /** 申请人用户 ID */
  requestedBy: string
  /** 审批人用户 ID；后台直发或尚未审批时为 null */
  approvedBy: string | null
  /** 渠道侧退款单号 */
  channelRefundId: string | null
  updatedAt: string
}

/** 管理端退款列表查询参数（全部可选，未传即不按该维度过滤） */
export interface AdminRefundQuery {
  organizationId?: string
  orderId?: string
  channel?: PaymentChannel
  status?: RefundStatus
  /** 精确匹配退款单号 */
  refundNo?: string
  /** 起始时间（ISO 8601） */
  from?: string
  /** 结束时间（ISO 8601） */
  to?: string
  page?: number
  /** 每页条数，后端上限 100 */
  limit?: number
}

/** 与订单/审计日志一致的分页包装 */
export interface AdminRefundPage {
  items: AdminRefund[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** 管理端试算：用户端字段 + 退款总开关状态 */
export interface AdminRefundQuote extends RefundQuote {
  /** `billing.refund.enabled`，false 时试算照常返回但提交会被拒 */
  enabled: boolean
}

/**
 * 后台发起退款（`POST /admin/refunds`）。
 *
 * 后台发起**直接提交渠道**（不走审批）：`type` 省略时按政策自动判定；
 * `MANUAL` 必须同时给 `amount`（分，正整数，≤ 可退上限）。
 */
export interface CreateAdminRefundParams {
  orderId: string
  type?: RefundType
  /** 人工指定金额（分），仅 `MANUAL` 需要 */
  amount?: number
  reason?: string
}

/** 人工关闭退款单（`POST /admin/refunds/:id/close`） */
export interface CloseAdminRefundParams {
  reason?: string
}

/** 单个聚合桶（状态 / 渠道 / 政策） */
export interface AdminRefundStatsBucket {
  count: number
  /** 申请金额合计（分） */
  amount: number
}

/** 失败原因聚合（后端截断 100 字符后按原因聚合，Top 20） */
export interface AdminRefundStatsFailure {
  reason: string
  count: number
}

/** 对账统计（`GET /admin/refunds/stats`） */
export interface AdminRefundStats {
  total: {
    count: number
    /** 申请金额合计（分） */
    amount: number
    /** 渠道实际退款金额合计（分） */
    settledAmount: number
  }
  byStatus: (AdminRefundStatsBucket & { status: RefundStatus })[]
  byChannel: (AdminRefundStatsBucket & { channel: PaymentChannel })[]
  byPolicy: (AdminRefundStatsBucket & { policyCode: RefundPolicyCode })[]
  failures: AdminRefundStatsFailure[]
}

/** 对账统计查询参数（时间区间 + 渠道） */
export interface AdminRefundStatsQuery {
  from?: string
  to?: string
  channel?: PaymentChannel
}
