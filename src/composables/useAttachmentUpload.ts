import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { uploadAttachment } from '@/api'
import type { UploadedObject } from '@/api/types/attachment'
import {
  evaluateAttachments,
  formatFileSize,
  remainingAttachmentSlots,
  type AttachmentKind,
  type AttachmentRejection,
} from '@/utils/attachment'

export interface AttachmentUploadOptions {
  /** 已上传列表，上传成功后会整体替换（保持响应式） */
  model: Ref<UploadedObject[]>
  kind: AttachmentKind
  /** 以下都用 getter：调用方的 props 是响应式的 */
  maxCount: () => number
  maxSize: () => number
  /** 上传目录，留空由后端按 users/<currentUserId> 落盘 */
  directory?: () => string | undefined
  disabled?: () => boolean
}

/**
 * 图片 / 文档上传的共享逻辑：本地校验 → 逐个上传 → 把 UploadedObject 追加进 v-model。
 *
 * 校验通过的按顺序串行上传（避免一次并发太多请求），单个失败不影响其余文件；
 * 失败提示由请求层统一处理，这里只负责本地规则（类型 / 大小 / 数量）的提示。
 */
export function useAttachmentUpload(options: AttachmentUploadOptions) {
  const { t } = useI18n()
  const uploading = ref(false)

  const remaining = computed(() =>
    remainingAttachmentSlots(options.maxCount(), options.model.value.length),
  )

  const canAdd = computed(
    () => !(options.disabled?.() ?? false) && remaining.value > 0 && !uploading.value,
  )

  function notifyRejected(rejected: AttachmentRejection[]) {
    for (const item of rejected) {
      if (item.reason === 'count') {
        MessagePlugin.error(t('upload.countExceeded', { count: options.maxCount() }))
        return
      }
      if (item.reason === 'size') {
        MessagePlugin.error(
          t('upload.sizeExceeded', {
            name: item.name,
            size: formatFileSize(options.maxSize()),
          }),
        )
        continue
      }
      MessagePlugin.error(t('upload.typeNotAllowed', { name: item.name }))
    }
  }

  async function addFiles(files: FileList | File[] | null): Promise<void> {
    const list = Array.from(files ?? [])
    if (!list.length || options.disabled?.() || uploading.value) return

    const { accepted, rejected } = evaluateAttachments(list, options.model.value.length, {
      kind: options.kind,
      maxSize: options.maxSize(),
      maxCount: options.maxCount(),
    })
    notifyRejected(rejected)
    if (!accepted.length) return

    uploading.value = true
    try {
      for (const file of accepted) {
        try {
          const uploaded = await uploadAttachment(file, options.directory?.())
          options.model.value = [...options.model.value, uploaded]
        } catch {
          // 请求层已统一提示；继续上传剩余文件
        }
      }
    } finally {
      uploading.value = false
    }
  }

  return { uploading, remaining, canAdd, addFiles }
}
