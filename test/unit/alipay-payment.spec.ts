import { AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAlipayPayment } from '@/api'
import type { Order } from '@/api/types/billing'
import { service, setupRequestAuth } from '@/utils/request'
import { formatCountdown, isOrderPayable, orderRemainingMs } from '@/utils/payment'
import { toQrCodeDataUrl } from '@/utils/qrcode'

vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

beforeEach(() => {
  setupRequestAuth({ getAccessToken: () => undefined })
})

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

const NOW = Date.parse('2026-10-21T12:10:00.000Z')

describe('isOrderPayable', () => {
  it('accepts a pending order before its expiry', () => {
    expect(isOrderPayable(order(), NOW)).toBe(true)
  })

  it('rejects every terminal status', () => {
    for (const status of ['PAID', 'CANCELLED', 'REFUNDED'] as const) {
      expect(isOrderPayable(order({ status }), NOW)).toBe(false)
    }
  })

  it('rejects a pending order whose expiry has passed', () => {
    expect(isOrderPayable(order(), Date.parse('2026-10-21T12:31:00.000Z'))).toBe(false)
  })

  it('keeps a pending order payable when the expiry cannot be parsed', () => {
    expect(isOrderPayable(order({ expiresAt: 'not-a-date' }), NOW)).toBe(true)
  })
})

describe('orderRemainingMs', () => {
  it('counts down to the expiry instant', () => {
    expect(orderRemainingMs(order(), NOW)).toBe(20 * 60 * 1000)
  })

  it('never returns a negative remainder', () => {
    expect(orderRemainingMs(order(), Date.parse('2026-10-21T13:00:00.000Z'))).toBe(0)
    expect(orderRemainingMs(order({ expiresAt: 'not-a-date' }), NOW)).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('formats minutes and seconds below one hour', () => {
    expect(formatCountdown(19 * 60 * 1000 + 5000)).toBe('19:05')
    expect(formatCountdown(59_000)).toBe('00:59')
  })

  it('adds the hour segment above one hour', () => {
    expect(formatCountdown(3661 * 1000)).toBe('01:01:01')
  })

  it('floors at zero', () => {
    expect(formatCountdown(-5000)).toBe('00:00')
  })
})

describe('createAlipayPayment', () => {
  it('posts channel=ALIPAY with precreate and returns the pay link', async () => {
    const calls: { url?: string; method?: string; data?: unknown }[] = []
    service.defaults.adapter = async (config) => {
      calls.push({ url: config.url, method: config.method, data: config.data })
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        data: { data: { channel: 'ALIPAY', qrCode: 'https://qr.alipay.com/bax0123' } },
      }
    }

    const params = await createAlipayPayment('order-1')

    expect(params.qrCode).toBe('https://qr.alipay.com/bax0123')
    expect(calls[0]?.url).toBe('/orders/order-1/pay')
    expect(calls[0]?.method).toBe('post')
    expect(JSON.parse(String(calls[0]?.data))).toEqual({
      channel: 'ALIPAY',
      payMethod: 'alipay.trade.precreate',
    })
  })

  it('can request the cashier page instead of the scan code', async () => {
    let payload: unknown
    service.defaults.adapter = async (config) => {
      payload = config.data
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        data: { data: { channel: 'ALIPAY', payUrl: 'https://openapi.alipay.com/gateway.do?...' } },
      }
    }

    const params = await createAlipayPayment('order-1', 'alipay.trade.page.pay')

    expect(params.payUrl).toContain('openapi.alipay.com')
    expect(JSON.parse(String(payload))).toEqual({
      channel: 'ALIPAY',
      payMethod: 'alipay.trade.page.pay',
    })
  })
})

describe('toQrCodeDataUrl', () => {
  it('renders the payment link as a PNG data URL', async () => {
    const dataUrl = await toQrCodeDataUrl('https://qr.alipay.com/bax0123')

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('rejects an empty payload instead of rendering a blank code', async () => {
    await expect(toQrCodeDataUrl('   ')).rejects.toThrow('QR code payload is empty')
  })
})
