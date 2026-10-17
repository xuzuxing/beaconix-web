import type { AttachmentRef, UploadedObject } from '@/api/types/attachment'

/**
 * 附件上传的展现层纯函数：类型 / 大小 / 数量的校验、文件大小格式化与元数据转换。
 * 只做数据整形，不发请求，便于单元测试（test/attachment.test.mjs）。
 */

/** 图片接受 png / jpeg / webp / gif；不收 SVG（可内嵌脚本） */
export const IMAGE_MIME_TYPES: string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',')

/** 日志 / PDF：日志文件在浏览器里 MIME 常为空或 text/plain，因此扩展名也要认 */
export const DOCUMENT_EXTENSIONS: string[] = ['.log', '.txt', '.pdf']

export const DOCUMENT_MIME_TYPES: string[] = ['application/pdf', 'text/plain']

export const DOCUMENT_ACCEPT = [...DOCUMENT_EXTENSIONS, ...DOCUMENT_MIME_TYPES].join(',')

/** 单个附件默认上限：5MB */
export const DEFAULT_ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024

/** 单次最多附件数：5 个 */
export const DEFAULT_ATTACHMENT_MAX_COUNT = 5

export type AttachmentKind = 'image' | 'document'

export interface AttachmentLimits {
  kind: AttachmentKind
  /** 单个文件大小上限（字节） */
  maxSize: number
  /** 已选 + 本次可接受的总数上限 */
  maxCount: number
}

/** 校验只需要这三个字段，File 天然满足 */
export interface AttachmentCandidate {
  name: string
  size: number
  type: string
}

export type AttachmentRejectionReason = 'size' | 'type' | 'count'

export interface AttachmentRejection {
  name: string
  reason: AttachmentRejectionReason
}

export interface AttachmentSelection<T extends AttachmentCandidate = AttachmentCandidate> {
  accepted: T[]
  rejected: AttachmentRejection[]
}

/** 取小写扩展名；没有扩展名（或只有隐藏文件名）时返回空串 */
export function fileExtension(name: string): string {
  const index = name.lastIndexOf('.')
  return index <= 0 ? '' : name.slice(index).toLowerCase()
}

function trimTrailingZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value
}

/** 人性化文件大小：512 B / 1.5 KB / 4.2 MB */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${trimTrailingZero(kb.toFixed(1))} KB`
  return `${trimTrailingZero((kb / 1024).toFixed(1))} MB`
}

/** 按 MIME 判断类型，MIME 缺失时回退到扩展名（日志文件常见） */
export function isAllowedType(candidate: AttachmentCandidate, kind: AttachmentKind): boolean {
  const mime = candidate.type.toLowerCase()
  if (kind === 'image') return IMAGE_MIME_TYPES.includes(mime)
  return (
    DOCUMENT_EXTENSIONS.includes(fileExtension(candidate.name)) ||
    DOCUMENT_MIME_TYPES.includes(mime)
  )
}

/** 图片与文档走同一套 accept 字符串，便于组件的默认 props */
export function attachmentAccept(kind: AttachmentKind): string {
  return kind === 'image' ? IMAGE_ACCEPT : DOCUMENT_ACCEPT
}

/**
 * 批量校验本次选择的文件。
 *
 * 三条规则按「类型 → 大小 → 数量」的顺序判断，一个文件只报第一个原因：
 * 先告诉用户格式不对，再谈体积，最后才是额度，避免一次抛出多条噪音。
 * `currentCount` 是已经上传成功的数量，额度按「已选 + 本次接受的」累计。
 */
export function evaluateAttachments<T extends AttachmentCandidate>(
  incoming: readonly T[],
  currentCount: number,
  limits: AttachmentLimits,
): AttachmentSelection<T> {
  const accepted: T[] = []
  const rejected: AttachmentRejection[] = []

  for (const candidate of incoming) {
    if (!isAllowedType(candidate, limits.kind)) {
      rejected.push({ name: candidate.name, reason: 'type' })
      continue
    }
    if (candidate.size > limits.maxSize) {
      rejected.push({ name: candidate.name, reason: 'size' })
      continue
    }
    if (currentCount + accepted.length >= limits.maxCount) {
      rejected.push({ name: candidate.name, reason: 'count' })
      continue
    }
    accepted.push(candidate)
  }

  return { accepted, rejected }
}

/** 剩余可上传数量 */
export function remainingAttachmentSlots(maxCount: number, used: number): number {
  return Math.max(0, maxCount - used)
}

/** 上传返回值 → 提交给业务接口的元数据 */
export function toAttachmentRef(object: UploadedObject): AttachmentRef {
  return {
    filename: object.filename,
    mimeType: object.mimeType,
    size: object.size,
    url: object.url,
    fileKey: object.fileKey,
  }
}

export function toAttachmentRefs(objects: readonly UploadedObject[]): AttachmentRef[] {
  return objects.map(toAttachmentRef)
}

/** 附件是否为图片：MIME 优先，缺失时按扩展名反推 */
export function isImageAttachment(
  attachment: Pick<AttachmentRef, 'filename' | 'mimeType'>,
): boolean {
  const mime = (attachment.mimeType ?? '').toLowerCase()
  if (mime) return mime.startsWith('image/')
  return !DOCUMENT_EXTENSIONS.includes(fileExtension(attachment.filename))
}
