/**
 * 二维码渲染工具。
 *
 * 支付宝 Native 支付只返回支付链接（`codeUrl`），二维码在浏览器本地生成：
 * 支付链接不经过任何第三方图片服务，扫码内容与下单结果始终一致。
 */
import QRCode from 'qrcode'

export interface QrCodeOptions {
  /** 二维码边长（像素），默认 240 */
  size?: number
  /** 纠错级别，默认 M；扫码场景下 M 已足够，且模块更少更易识别 */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  /** 二维码四周留白（模块数），默认 2 */
  margin?: number
  /** 深色模块颜色，默认纯黑 */
  dark?: string
  /** 浅色背景颜色，默认纯白 */
  light?: string
}

/**
 * 把文本渲染成 PNG dataURL，可直接塞进 `<img :src>`。
 * 空内容没有可扫的语义，直接抛错而不是生成一张空二维码。
 */
export async function toQrCodeDataUrl(text: string, options: QrCodeOptions = {}): Promise<string> {
  const payload = text.trim()
  if (!payload) throw new Error('QR code payload is empty')

  const {
    size = 240,
    errorCorrectionLevel = 'M',
    margin = 2,
    dark = '#000000',
    light = '#ffffff',
  } = options

  return QRCode.toDataURL(payload, {
    width: size,
    margin,
    errorCorrectionLevel,
    color: { dark, light },
  })
}
