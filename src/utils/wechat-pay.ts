/**
 * 微信 JSAPI 支付适配层。
 *
 * 后端 `POST /orders/:id/pay` 只返回 wx.requestPayment 所需的签名参数，
 * 真正把支付调起来还需要两个前提：微信内置浏览器 + 付款人 openid。
 * 这里把环境检测、openid 获取与调起支付收敛到一处，页面只面对 payOrder()。
 *
 * 注意：当前 Web 端主支付路径是支付宝 Native 扫码（见 `utils/alipay-pay.ts`），
 * 微信渠道暂未接入页面；本模块保留以备后续接入，不在 UI 中引用。
 */
import { createOrderPayment } from '@/api'
import type { Order, OrderPaymentParams, WechatPayParams } from '@/api/types/billing'

export { waitForOrderPaid, type WaitForOrderPaidOptions } from './payment'

/** wx.requestPayment 的最小类型声明（微信 JS-SDK 未随项目打包，按需注入） */
interface WxPaymentOptions {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
  success: (res: unknown) => void
  fail: (res: { errMsg?: string }) => void
}

interface WxApi {
  requestPayment?: (options: WxPaymentOptions) => void
}

const OPENID_STORAGE_KEY = 'beacon-vue3:wechat-openid'

/** 支付调起结果：成功 / 用户取消 / 失败 / 当前环境无法调起 */
export type WechatPayOutcome = 'success' | 'cancelled' | 'failed' | 'unavailable'

/** 微信内置浏览器检测（wx.requestPayment 只在微信内可用） */
export function isWechatBrowser(): boolean {
  return /micromessenger/i.test(navigator.userAgent)
}

let openidProvider: (() => string | undefined) | undefined

/**
 * 注入 openid 来源（例如微信网页授权回调后写入）。
 * 未注入时回退到 URL 的 `openid` 查询参数与本地存储。
 */
export function setWechatOpenidProvider(provider: (() => string | undefined) | undefined) {
  openidProvider = provider
}

/** 缓存 openid，供后续支付复用 */
export function setWechatOpenid(openid: string) {
  localStorage.setItem(OPENID_STORAGE_KEY, openid)
}

/** 读取当前可用的 openid，取不到时返回 undefined */
export function getWechatOpenid(): string | undefined {
  if (openidProvider) return openidProvider()

  const fromQuery = new URLSearchParams(window.location.search).get('openid')
  if (fromQuery) return fromQuery

  return localStorage.getItem(OPENID_STORAGE_KEY) ?? undefined
}

/** 是否为微信 JSAPI 的支付参数（而非支付宝 Native 的支付链接） */
export function isWechatPayParams(params: OrderPaymentParams): params is WechatPayParams {
  return 'paySign' in params && 'package' in params
}

/** 调起 wx.requestPayment；未加载微信 JS-SDK 时按环境不可用处理 */
export function requestWechatPayment(params: WechatPayParams): Promise<WechatPayOutcome> {
  const wx = (window as unknown as { wx?: WxApi }).wx
  if (!wx?.requestPayment) {
    return Promise.resolve('unavailable')
  }

  const requestPayment = wx.requestPayment
  return new Promise<WechatPayOutcome>((resolve) => {
    requestPayment({
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
      success: () => resolve('success'),
      // 用户主动取消与真正的失败要区分开，取消不应提示「支付失败」
      fail: (res) => resolve(/(?:cancel|取消)/i.test(res.errMsg ?? '') ? 'cancelled' : 'failed'),
    })
  })
}

/**
 * 为订单发起微信支付：后端下单拿到签名参数，再调起 wx.requestPayment。
 * 订单状态由后端支付回调更新，前端需自行轮询（见 waitForOrderPaid）。
 */
export async function payOrder(orderId: string, openid: string): Promise<WechatPayOutcome> {
  const params = await createOrderPayment<WechatPayParams>(orderId, {
    openid,
    channel: 'WECHAT',
  })
  return requestWechatPayment(params)
}

/** 兼容旧引用：订单类型在这里对页面可见 */
export type WechatOrder = Order
