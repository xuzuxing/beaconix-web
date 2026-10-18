import { generateFace, generateRandomConfig, type FaceConfig } from '@ignaciocabeza/bitface'

/**
 * 像素人脸头像（bitface）：`generateFace(config)` 输出 16×16 viewBox 的内联 SVG。
 *
 * 补三件事让它接进现有附件链路：
 * - 预览直接用 SVG dataURL（矢量清晰，也不为缩略图跑 canvas）
 * - 上传前转成 PNG（上传链路只收 png / jpeg / webp / gif，不收 SVG）
 * - 显式补 width/height（bitface 只输出 viewBox，画进 canvas 时个别浏览器会当成 0×0）
 */

/** 上传用的 PNG 边长 */
export const FACE_SIZE = 256

export type FaceAvatarConfig = FaceConfig

/** 随机一张脸 */
export function randomFaceConfig(): FaceAvatarConfig {
  return generateRandomConfig()
}

/** 同一 config 的稳定标识：v-for key、选中态与文件名都用它 */
export function faceKey(config: FaceAvatarConfig): string {
  return JSON.stringify(config)
}

export function faceSvg(config: FaceAvatarConfig, size = FACE_SIZE): string {
  return withSize(generateFace(config), size)
}

/** 预览地址：SVG dataURL */
export function facePreviewUrl(config: FaceAvatarConfig, size = 160): string {
  return svgDataUrl(faceSvg(config, size))
}

/** 待上传的 PNG 文件；没有 canvas 实现（无 DOM 环境）时返回 null */
export function faceFile(config: FaceAvatarConfig, size = FACE_SIZE): Promise<File | null> {
  return rasterize(faceSvg(config, size), size, `avatar-${shortHash(faceKey(config))}`)
}

/** 显式宽高：避免「只有 viewBox 的 SVG 画进 canvas 变成 0×0」 */
function withSize(svg: string, size: number): string {
  return svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function shortHash(source: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** SVG → canvas → PNG 文件；解码失败或没有 canvas 实现时返回 null */
async function rasterize(svg: string, size: number, name: string): Promise<File | null> {
  const image = await loadSvg(svg)
  if (!image) return null

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null

  // 像素风：关掉平滑，放大后保持硬边
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, size, size)
  context.drawImage(image, 0, 0, size, size)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png')
  })
  if (!blob) return null
  return new File([blob], `${name}.png`, { type: 'image/png' })
}

function loadSvg(svg: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = svgDataUrl(svg)
  })
}
