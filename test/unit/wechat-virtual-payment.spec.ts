import { AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWechatVirtualPayment } from '@/api'
import { service, setupRequestAuth } from '@/utils/request'

/**
 * 小程序虚拟支付预下单（api-5 `channel=WECHAT_VIRTUAL`）：
 * 请求体必须带 wx.login() 的一次性 code，响应是 wx.requestVirtualPayment 的三个参数。
 */
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

beforeEach(() => {
  setupRequestAuth({ getAccessToken: () => undefined })
})

describe('createWechatVirtualPayment', () => {
  it('posts channel=WECHAT_VIRTUAL with a fresh wx.login code', async () => {
    const calls: { url?: string; method?: string; data?: unknown }[] = []
    service.defaults.adapter = async (config) => {
      calls.push({ url: config.url, method: config.method, data: config.data })
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        data: {
          data: {
            signData: '{"offerId":"123","buyQuantity":1}',
            paySig: 'pay-sig',
            signature: 'user-sig',
          },
        },
      }
    }

    const params = await createWechatVirtualPayment('order-1', 'wx-code-1')

    expect(params).toEqual({
      signData: '{"offerId":"123","buyQuantity":1}',
      paySig: 'pay-sig',
      signature: 'user-sig',
    })
    expect(calls[0]?.url).toBe('/orders/order-1/pay')
    expect(calls[0]?.method).toBe('post')
    expect(JSON.parse(String(calls[0]?.data))).toEqual({
      channel: 'WECHAT_VIRTUAL',
      code: 'wx-code-1',
    })
  })
})
