/**
 * 订单支付通用逻辑：可支付判断、剩余时间与状态轮询。
 *
 * 各渠道的差异（支付宝 Native 扫码、微信 JSAPI 调起）留在各自模块，
 * 这里只保留所有渠道都要用到的部分。
 */
import { getOrder } from '@/api'
import type { Order } from '@/api/types/billing'

/** 待支付订单是否还能付款：状态为 PENDING 且未过期 */
export function isOrderPayable(
  order: Pick<Order, 'status' | 'expiresAt'>,
  now = Date.now(),
): boolean {
  if (order.status !== 'PENDING') return false

  const expiresAt = Date.parse(order.expiresAt)
  // 过期时间无法解析时按「不限制」处理，避免误拦可支付订单
  return Number.isNaN(expiresAt) || expiresAt > now
}

/** 距离订单过期还剩多少毫秒；已过期或时间不可解析时返回 0 */
export function orderRemainingMs(order: Pick<Order, 'expiresAt'>, now = Date.now()): number {
  const expiresAt = Date.parse(order.expiresAt)
  if (Number.isNaN(expiresAt)) return 0
  return Math.max(0, expiresAt - now)
}

/** 剩余毫秒 → 倒计时文案：不足 1 小时用 mm:ss，否则 hh:mm:ss */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

export interface WaitForOrderPaidOptions {
  /** 轮询间隔（毫秒），默认 2000 */
  intervalMs?: number
  /** 最长等待时间（毫秒），默认 60000 */
  timeoutMs?: number
  /** 中止信号：弹窗关闭或切换订单时停止轮询，避免泄漏与过期响应 */
  signal?: AbortSignal
}

/** 可被 signal 打断的等待 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }

    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })
}

/**
 * 轮询订单直到不再处于 PENDING（支付回调在服务端异步完成）。
 * 返回最终订单；超时、中止或订单进入终态时返回最后一次快照。
 */
export async function waitForOrderPaid(
  orderId: string,
  options: WaitForOrderPaidOptions = {},
): Promise<Order> {
  const { intervalMs = 2000, timeoutMs = 60_000, signal } = options
  const deadline = Date.now() + timeoutMs

  let order = await getOrder(orderId)
  while (order.status === 'PENDING' && !signal?.aborted && Date.now() < deadline) {
    await delay(intervalMs, signal)
    if (signal?.aborted) break
    order = await getOrder(orderId)
  }

  return order
}
