import { AxiosHeaders } from 'axios'
import { beforeEach, expect, it, vi } from 'vitest'

import * as adminApi from '@/api/modules/admin-refund'
import * as api from '@/api/modules/refund'
import { service, setupRequestAuth } from '@/utils/request'

vi.mock('tdesign-vue-next', () => ({ MessagePlugin: { error: vi.fn() } }))

beforeEach(() => {
  setupRequestAuth({ getAccessToken: () => undefined })
})

interface Call {
  url?: string
  method?: string
  data: unknown
  params: unknown
}

/** 记录请求并回放固定响应体（响应拦截器会解包 data） */
function stub(payload: unknown): Call[] {
  const calls: Call[] = []
  service.defaults.adapter = async (config) => {
    calls.push({
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params,
    })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: { data: payload },
    }
  }
  return calls
}

it('calls the user refund routes with encoded order ids', async () => {
  const calls = stub([])

  await api.getOrderRefundQuote('order/1')
  await api.listOrderRefunds('order/1')
  await api.createOrderRefund('order/1', { reason: 'not needed' })

  expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
    'get /orders/order%2F1/refund-quote',
    'get /orders/order%2F1/refunds',
    'post /orders/order%2F1/refunds',
  ])
  expect(JSON.parse(String(calls[2]?.data))).toEqual({ reason: 'not needed' })
})

it('defaults the refund request body to an empty object', async () => {
  const calls = stub({ id: 'refund-1', status: 'PENDING' })
  await api.createOrderRefund('order-1')
  expect(JSON.parse(String(calls[0]?.data))).toEqual({})
})

it('calls the admin refund routes with filters and bodies', async () => {
  const calls = stub({ items: [], total: 0, page: 1, limit: 25, totalPages: 0 })

  await adminApi.listAdminRefunds({ status: 'PROCESSING', channel: 'WECHAT', page: 2, limit: 25 })
  await adminApi.getAdminRefundQuote('order-1')
  await adminApi.createAdminRefund({
    orderId: 'order-1',
    type: 'MANUAL',
    amount: 5000,
    reason: 'support credit',
  })
  await adminApi.approveAdminRefund('refund/1')
  await adminApi.retryAdminRefund('refund/1')
  await adminApi.closeAdminRefund('refund/1', { reason: 'duplicate' })
  await adminApi.getAdminRefundStats({ channel: 'ALIPAY' })

  expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
    'get /admin/refunds',
    'get /admin/refunds/quote/order-1',
    'post /admin/refunds',
    'post /admin/refunds/refund%2F1/approve',
    'post /admin/refunds/refund%2F1/retry',
    'post /admin/refunds/refund%2F1/close',
    'get /admin/refunds/stats',
  ])
  expect(calls[0]?.params).toEqual({ status: 'PROCESSING', channel: 'WECHAT', page: 2, limit: 25 })
  expect(calls[6]?.params).toEqual({ channel: 'ALIPAY' })
  expect(JSON.parse(String(calls[2]?.data))).toEqual({
    orderId: 'order-1',
    type: 'MANUAL',
    amount: 5000,
    reason: 'support credit',
  })
  expect(JSON.parse(String(calls[5]?.data))).toEqual({ reason: 'duplicate' })
})

it('passes an empty body when approving or retrying without payload', async () => {
  const calls = stub({ id: 'refund-1', status: 'PROCESSING' })
  await adminApi.approveAdminRefund('refund-1')
  await adminApi.retryAdminRefund('refund-1')
  expect(calls).toHaveLength(2)
  expect(calls[0]?.data).toBeUndefined()
})
