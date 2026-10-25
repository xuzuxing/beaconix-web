import { flushPromises, mount } from '@vue/test-utils'
import { MessagePlugin } from 'tdesign-vue-next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { Order } from '@/api/types/billing'
import AlipayQrPayDialog from '@/components/billing/AlipayQrPayDialog.vue'
import { componentOptions } from '../fixtures/components'

/**
 * 支付宝扫码弹窗：二维码来自本地渲染，支付结果只认订单状态轮询。
 * 这里用假的 API 与二维码工具覆盖「出码 / 支付成功闭环 / 过期拦截 / 出码失败」。
 */
const { createAlipayPayment, getOrder, toQrCodeDataUrl } = vi.hoisted(() => ({
  createAlipayPayment: vi.fn(),
  getOrder: vi.fn(),
  toQrCodeDataUrl: vi.fn(),
}))

vi.mock('@/api', () => ({ createAlipayPayment, getOrder }))
vi.mock('@/utils/qrcode', () => ({ toQrCodeDataUrl }))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

const QR_DATA_URL = 'data:image/png;base64,Qk9BQ09O'

const loadingStub = defineComponent({
  props: ['text'],
  setup: (props) => () => h('div', { class: 'loading-stub' }, props.text ?? ''),
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
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function mountDialog(target: Order | null) {
  const options = componentOptions()
  return mount(AlipayQrPayDialog, {
    props: { visible: true, order: target },
    global: {
      ...options,
      stubs: { ...options.stubs, TLoading: loadingStub },
    },
  })
}

beforeEach(() => {
  createAlipayPayment.mockReset()
  getOrder.mockReset()
  toQrCodeDataUrl.mockReset()

  createAlipayPayment.mockResolvedValue({
    channel: 'ALIPAY',
    qrCode: 'https://qr.alipay.com/bax0123',
  })
  toQrCodeDataUrl.mockResolvedValue(QR_DATA_URL)
  getOrder.mockResolvedValue(order())
  vi.mocked(MessagePlugin.success).mockReset()
})

describe('AlipayQrPayDialog', () => {
  it('turns the Native pay link into a scannable QR code', async () => {
    const wrapper = mountDialog(order())
    await flushPromises()

    expect(createAlipayPayment).toHaveBeenCalledWith('order-1')
    expect(toQrCodeDataUrl).toHaveBeenCalledWith('https://qr.alipay.com/bax0123', {
      size: 200,
    })

    const image = wrapper.find('img')
    expect(image.exists()).toBe(true)
    expect(image.attributes('src')).toBe(QR_DATA_URL)

    const text = wrapper.text()
    expect(text).toContain('¥29.00')
    expect(text).toContain('BWM123')

    wrapper.unmount()
  })

  it('notifies the parent and closes itself once the order turns PAID', async () => {
    getOrder.mockResolvedValue(order({ status: 'PAID', paidAt: new Date().toISOString() }))

    const wrapper = mountDialog(order())
    await flushPromises()

    expect(wrapper.emitted('paid')?.[0]?.[0]).toMatchObject({ id: 'order-1', status: 'PAID' })
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    expect(MessagePlugin.success).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('refuses to request a QR code for an expired order', async () => {
    const wrapper = mountDialog(order({ expiresAt: new Date(Date.now() - 60_000).toISOString() }))
    await flushPromises()

    expect(createAlipayPayment).not.toHaveBeenCalled()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('订单已超时')

    wrapper.unmount()
  })

  it('shows a retryable failure when the pre-order call breaks', async () => {
    createAlipayPayment.mockRejectedValue(new Error('gateway down'))

    const wrapper = mountDialog(order())
    await flushPromises()

    expect(toQrCodeDataUrl).not.toHaveBeenCalled()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('支付二维码生成失败')

    wrapper.unmount()
  })

  it('treats a cashier-link response as a failure to render a QR code', async () => {
    createAlipayPayment.mockResolvedValue({
      channel: 'ALIPAY',
      payUrl: 'https://openapi.alipay.com/gateway.do?biz_content=...',
    })

    const wrapper = mountDialog(order())
    await flushPromises()

    expect(toQrCodeDataUrl).not.toHaveBeenCalled()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('支付二维码生成失败')

    wrapper.unmount()
  })
})
