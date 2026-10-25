import { expect, it } from 'vitest'

import type { Refund, RefundStatus } from '@/api/types/refund'
import {
  adminRefundActions,
  canManageRefunds,
  canSubmitRefund,
  isRefundInFlight,
  isRefundSettled,
  latestRefund,
  REFUND_POLICY_CODES,
  REFUND_STATUSES,
  refundDisplayAmount,
  refundStatusTheme,
  shouldStopRefundPolling,
} from '@/utils/refund'

function refund(overrides: Partial<Refund> = {}): Refund {
  return {
    id: 'refund-1',
    refundNo: 'RF1',
    status: 'PENDING',
    type: 'PRORATED',
    amount: 19933,
    settledAmount: null,
    policyCode: 'PRORATED',
    usedDays: 10,
    remainingDays: 20,
    reason: null,
    failureReason: null,
    refundedAt: null,
    createdAt: '2026-03-05T12:00:00.000Z',
    ...overrides,
  }
}

it('keeps the status order aligned with the backend state machine', () => {
  expect(REFUND_STATUSES).toEqual(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CLOSED'])
  expect(REFUND_POLICY_CODES).toContain('COOLING_OFF')
  expect(REFUND_POLICY_CODES).toHaveLength(7)
})

it('maps every status to a tag theme', () => {
  expect(refundStatusTheme('PENDING')).toBe('warning')
  expect(refundStatusTheme('PROCESSING')).toBe('primary')
  expect(refundStatusTheme('SUCCESS')).toBe('success')
  expect(refundStatusTheme('FAILED')).toBe('danger')
  expect(refundStatusTheme('CLOSED')).toBe('default')
})

it('treats FAILED as retryable rather than terminal', () => {
  const statuses: RefundStatus[] = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CLOSED']
  expect(statuses.filter(isRefundInFlight)).toEqual(['PENDING', 'PROCESSING'])
  expect(statuses.filter(isRefundSettled)).toEqual(['SUCCESS', 'CLOSED'])
  // 用户端轮询在 FAILED 也停下：后台重试前不会再有变化
  expect(statuses.filter(shouldStopRefundPolling)).toEqual(['SUCCESS', 'FAILED', 'CLOSED'])
})

it('picks the newest refund regardless of transport order', () => {
  expect(latestRefund([])).toBeNull()
  expect(latestRefund(undefined)).toBeNull()
  const older = refund({ id: 'older', createdAt: '2026-03-01T00:00:00.000Z' })
  const newer = refund({ id: 'newer', createdAt: '2026-03-05T00:00:00.000Z' })
  expect(latestRefund([older, newer])?.id).toBe('newer')
  expect(latestRefund([newer, older])?.id).toBe('newer')
})

it('requires ADMIN or above to submit a self-service refund', () => {
  expect(canManageRefunds('OWNER')).toBe(true)
  expect(canManageRefunds('ADMIN')).toBe(true)
  expect(canManageRefunds('MEMBER')).toBe(false)
  expect(canManageRefunds('VIEWER')).toBe(false)
  expect(canManageRefunds(null)).toBe(false)
})

it('only shows the refund entry when policy and self-service switch both allow it', () => {
  const quote = { eligible: true, selfServiceEnabled: true }
  expect(canSubmitRefund(quote, true)).toBe(true)
  expect(canSubmitRefund(quote, false)).toBe(false)
  expect(canSubmitRefund({ ...quote, eligible: false }, true)).toBe(false)
  expect(canSubmitRefund({ ...quote, selfServiceEnabled: false }, true)).toBe(false)
  expect(canSubmitRefund(null, true)).toBe(false)
})

it('shows settled amount after success and requested amount otherwise', () => {
  expect(refundDisplayAmount(refund({ status: 'SUCCESS', settledAmount: 19000 }))).toBe(19000)
  expect(refundDisplayAmount(refund({ status: 'SUCCESS', settledAmount: null }))).toBe(19933)
  expect(refundDisplayAmount(refund({ status: 'PENDING', settledAmount: 19000 }))).toBe(19933)
})

it('derives admin actions from the refund status', () => {
  expect(adminRefundActions({ status: 'PENDING' })).toEqual({
    canApprove: true,
    canRetry: false,
    canClose: true,
  })
  expect(adminRefundActions({ status: 'PROCESSING' })).toEqual({
    canApprove: false,
    canRetry: false,
    canClose: true,
  })
  expect(adminRefundActions({ status: 'FAILED' })).toEqual({
    canApprove: false,
    canRetry: true,
    canClose: true,
  })
  expect(adminRefundActions({ status: 'SUCCESS' })).toEqual({
    canApprove: false,
    canRetry: false,
    canClose: false,
  })
  expect(adminRefundActions({ status: 'CLOSED' })).toEqual({
    canApprove: false,
    canRetry: false,
    canClose: false,
  })
})
