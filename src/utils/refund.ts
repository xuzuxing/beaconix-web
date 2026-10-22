/**
 * 退款相关的展现层纯函数与枚举常量。
 *
 * 只做数据整形与状态判断，不发请求，便于单元测试（test/unit/refund-presenter.spec.ts）。
 * 文案统一由调用方按 `usage.refund.*` / `adminPage.refund.*` 的键查表。
 */
import type { MembershipRole } from '@/api/types'
import type {
  Refund,
  RefundPolicyCode,
  RefundQuote,
  RefundStatus,
  RefundType,
  SubscriptionEffect,
} from '@/api/types/refund'

/** 状态机顺序，与后端枚举一致；下拉与统计表格按此顺序展示 */
export const REFUND_STATUSES: readonly RefundStatus[] = [
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'CLOSED',
]

/** 管理端可主动发起的退款算法（省略 type 时由后端按政策判定） */
export const REFUND_TYPES: readonly RefundType[] = ['FULL', 'PRORATED', 'MANUAL']

export const REFUND_POLICY_CODES: readonly RefundPolicyCode[] = [
  'NOT_STARTED',
  'COOLING_OFF',
  'PRORATED',
  'EXPIRED',
  'NON_REFUNDABLE',
  'ALREADY_REFUNDED',
  'MANUAL',
]

export const SUBSCRIPTION_EFFECTS: readonly SubscriptionEffect[] = [
  'CANCEL_PENDING',
  'EXPIRE_NOW',
  'SHRINK',
  'NONE',
]

/** 状态对应的标签主题 */
export function refundStatusTheme(
  status: RefundStatus,
): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'PENDING':
      return 'warning'
    case 'PROCESSING':
      return 'primary'
    case 'SUCCESS':
      return 'success'
    case 'FAILED':
      return 'danger'
    default:
      return 'default'
  }
}

/** 已提交渠道、等结果的中间态（运营驳回前必须展示进度） */
export function isRefundInFlight(status: RefundStatus): boolean {
  return status === 'PENDING' || status === 'PROCESSING'
}

/**
 * 是否真正的终态：`SUCCESS` / `CLOSED`。
 * `FAILED` 不是终态——后台可以用同一退款单号重试。
 */
export function isRefundSettled(status: RefundStatus): boolean {
  return status === 'SUCCESS' || status === 'CLOSED'
}

/**
 * 是否应该停止轮询。
 *
 * 用户端只看进度，`FAILED` 会一直停留到后台重试，因此按文档把
 * `SUCCESS` / `FAILED` / `CLOSED` 都视为「可以停」。
 */
export function shouldStopRefundPolling(status: RefundStatus): boolean {
  return status === 'SUCCESS' || status === 'FAILED' || status === 'CLOSED'
}

/**
 * 退款单列表里真正生效的那一条。
 *
 * 后端按 `createdAt` 倒序返回，这里仍做一次排序，避免依赖传输顺序。
 */
export function latestRefund(refunds: readonly Refund[] | null | undefined): Refund | null {
  if (!refunds?.length) return null
  return refunds.reduce((latest, refund) =>
    Date.parse(refund.createdAt) > Date.parse(latest.createdAt) ? refund : latest,
  )
}

/**
 * 当前组织角色能否提交自助退款：与后端 `POST /orders/:id/refunds` 的 ADMIN+ 一致。
 * 前端只用于决定是否展示入口，后端仍会二次校验。
 */
export function canManageRefunds(role: MembershipRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

/**
 * 是否展示「申请退款」按钮。
 *
 * 两个开关都要判断：`eligible` 来自政策试算，`selfServiceEnabled` 是后台的用户自助开关；
 * 总开关（`billing.refund.enabled`）用户端试算拿不到，提交被拒时按错误提示处理。
 */
export function canSubmitRefund(
  quote: Pick<RefundQuote, 'eligible' | 'selfServiceEnabled'> | null | undefined,
  canManage: boolean,
): boolean {
  if (!quote) return false
  return canManage && quote.eligible && quote.selfServiceEnabled
}

/** 退款金额展示兜底：未成功时用申请金额，成功后优先展示渠道实退金额 */
export function refundDisplayAmount(
  refund: Pick<Refund, 'status' | 'amount' | 'settledAmount'>,
): number {
  if (refund.status === 'SUCCESS' && typeof refund.settledAmount === 'number') {
    return refund.settledAmount
  }
  return refund.amount
}

/** 试算里有手续费的场景：金额与原始折算金额不一致 */
export function quoteHasFee(quote: Pick<RefundQuote, 'feeAmount'>): boolean {
  return quote.feeAmount > 0
}

/** 管理端可执行的动作，与后端状态机一一对应 */
export interface AdminRefundActions {
  /** PENDING → 提交渠道 */
  canApprove: boolean
  /** FAILED → 同号重新提交 */
  canRetry: boolean
  /** PENDING / PROCESSING / FAILED → 人工关闭 */
  canClose: boolean
}

export function adminRefundActions(refund: Pick<Refund, 'status'>): AdminRefundActions {
  return {
    canApprove: refund.status === 'PENDING',
    canRetry: refund.status === 'FAILED',
    canClose: refund.status !== 'SUCCESS' && refund.status !== 'CLOSED',
  }
}
