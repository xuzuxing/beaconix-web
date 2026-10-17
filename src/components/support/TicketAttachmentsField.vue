<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AttachmentRef, UploadedObject } from '@/api/types/attachment'
import AttachmentUploader from '@/components/upload/AttachmentUploader.vue'
import ImageUploader from '@/components/upload/ImageUploader.vue'
import {
  DEFAULT_ATTACHMENT_MAX_COUNT,
  DEFAULT_ATTACHMENT_MAX_SIZE,
  remainingAttachmentSlots,
  toAttachmentRefs,
} from '@/utils/attachment'

/**
 * 工单附件字段：图片与日志 / PDF 两组上传，共用一个「最多 5 个」的额度。
 *
 * 两个上传组件各自维护自己的已上传列表，额度按「总数扣除对方已选」交叉计算，
 * 对外只暴露提交给后端的 `AttachmentRef[]`（v-model）。
 * 父层把 v-model 置空即可清空整组（提交 / 回复成功后）。
 */
defineOptions({ name: 'TicketAttachmentsField' })

const attachments = defineModel<AttachmentRef[]>({ default: () => [] })
const props = withDefaults(
  defineProps<{
    maxCount?: number
    maxSize?: number
    /** 上传目录：工单统一落在 tickets 下 */
    directory?: string
    disabled?: boolean
  }>(),
  {
    maxCount: DEFAULT_ATTACHMENT_MAX_COUNT,
    maxSize: DEFAULT_ATTACHMENT_MAX_SIZE,
    directory: 'tickets',
    disabled: false,
  },
)

const { t } = useI18n()
const images = ref<UploadedObject[]>([])
const files = ref<UploadedObject[]>([])

/** 交叉额度：图片区还能传「总数 - 已传文件数」，反之亦然 */
const imageMaxCount = computed(() => remainingAttachmentSlots(props.maxCount, files.value.length))
const fileMaxCount = computed(() => remainingAttachmentSlots(props.maxCount, images.value.length))

const total = computed(() => images.value.length + files.value.length)

watch(
  [images, files],
  () => {
    const next = toAttachmentRefs([...images.value, ...files.value])
    // 清空时避免「父层置空 → 内部清空 → 再次 emit 空数组」的来回触发
    if (!next.length && !attachments.value.length) return
    attachments.value = next
  },
  { deep: true },
)

// 父层清空 v-model（提交成功后）时同步清掉两个上传组件里的列表
watch(attachments, (value) => {
  if (value?.length) return
  if (images.value.length) images.value = []
  if (files.value.length) files.value = []
})

defineExpose({ total })
</script>

<template>
  <div class="ticket-attachments">
    <section class="ticket-attachments__section">
      <h5 class="ticket-attachments__title">{{ t('upload.imageSection') }}</h5>
      <ImageUploader
        v-model="images"
        :max-count="imageMaxCount"
        :max-size="maxSize"
        :directory="directory"
        :disabled="disabled"
      />
    </section>

    <section class="ticket-attachments__section">
      <h5 class="ticket-attachments__title">{{ t('upload.fileSection') }}</h5>
      <AttachmentUploader
        v-model="files"
        :max-count="fileMaxCount"
        :max-size="maxSize"
        :directory="directory"
        :disabled="disabled"
      />
    </section>
  </div>
</template>

<style scoped lang="less">
.ticket-attachments {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-secondary;
  }
}
</style>
