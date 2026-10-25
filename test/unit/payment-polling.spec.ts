import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Order } from '@/api/types/billing'

/**
 * 订单轮询是支付宝扫码支付的唯一结果来源，这里用假的 getOrder 覆盖
 * 「已支付立即返回 / 轮询到已支付 / 中止信号 / 超时」四条路径。
 */
const { getOrder } = vi.hoisted(() => ({ getOrder: vi.fn() }))

vi.mock('@/api', () => ({ getOrder }))
vi.mock('tdesign-vue-next', () => ({ MessagePlugin: { error: vi.fn() } }))

const { waitForOrderPaid } = await import('@/utils/payment')

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNo: 'BWM123',
    organizationId: 'org-1',
    planId: 'plan-1',
    userId: 'user-1',
    amount: 2900,
    currency: 'CNY',
    durationDays: 30,
    cycle: 'MONTHLY',
    termId: 'term-1',
    status: 'PENDING',
    paidAt: null,
    cancelledAt: null,
    expiresAt: '2026-10-21T12:30:00.000Z',
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  getOrder.mockReset()
})

describe('waitForOrderPaid', () => {
  it('returns the first snapshot when the order is already paid', async () => {
    getOrder.mockResolvedValue(order({ status: 'PAID' }))

    const latest = await waitForOrderPaid('order-1', { intervalMs: 1 })

    expect(latest.status).toBe('PAID')
    expect(getOrder).toHaveBeenCalledTimes(1)
  })

  it('polls until the backend flips the order to PAID', async () => {
    getOrder
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(order({ status: 'PAID', paidAt: '2026-10-21T12:11:00.000Z' }))

    const latest = await waitForOrderPaid('order-1', { intervalMs: 1 })

    expect(latest.status).toBe('PAID')
    expect(getOrder).toHaveBeenCalledTimes(2)
  })

  it('stops without another request once the signal is aborted', async () => {
    const controller = new AbortController()
    getOrder.mockResolvedValue(order())
    controller.abort()

    const latest = await waitForOrderPaid('order-1', {
      intervalMs: 1,
      signal: controller.signal,
    })

    expect(latest.status).toBe('PENDING')
    expect(getOrder).toHaveBeenCalledTimes(1)
  })

  it('gives up at the deadline and returns the last pending snapshot', async () => {
    getOrder.mockResolvedValue(order())

    const latest = await waitForOrderPaid('order-1', { intervalMs: 1, timeoutMs: 0 })

    expect(latest.status).toBe('PENDING')
    expect(getOrder).toHaveBeenCalledTimes(1)
  })
})
