<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AttachmentRef } from '@/api/types/attachment'
import AppIcon from '@/components/AppIcon.vue'
import { Archive02Icon, Invoice01Icon } from '@/icons'
import { formatFileSize, isImageAttachment } from '@/utils/attachment'

/**
 * 工单附件展示：图片走缩略图 + 点击预览，日志 / PDF 走文件行 + 新窗口下载。
 * 附件为空时整块不渲染，调用方不需要自己判断。
 */
defineOptions({ name: 'TicketAttachmentList' })

const props = withDefaults(
  defineProps<{
    attachments: AttachmentRef[] | null | undefined
    /** 紧凑模式：缩略图更小，用于时间线条目下方 */
    compact?: boolean
  }>(),
  { compact: false },
)

const { t } = useI18n()
const viewerVisible = ref(false)
const viewerIndex = ref(0)

const items = computed(() => props.attachments ?? [])
const images = computed(() => items.value.filter((item) => isImageAttachment(item)))
const files = computed(() => items.value.filter((item) => !isImageAttachment(item)))
const imageUrls = computed(() => images.value.map((item) => item.url))

function openViewer(index: number) {
  viewerIndex.value = index
  viewerVisible.value = true
}

function fileIcon(item: AttachmentRef) {
  return item.mimeType === 'application/pdf' ? Invoice01Icon : Archive02Icon
}
</script>

<template>
  <div v-if="items.length" class="attachment-list" :class="{ 'is-compact': compact }">
    <div v-if="images.length" class="attachment-list__images">
      <button
        v-for="(item, index) in images"
        :key="item.fileKey || item.url"
        type="button"
        class="attachment-list__thumb"
        :aria-label="t('upload.preview')"
        :title="item.filename"
        @click="openViewer(index)"
      >
        <img :src="item.url" :alt="item.filename" loading="lazy" />
      </button>
    </div>

    <ul v-if="files.length" class="attachment-list__files">
      <li v-for="item in files" :key="item.fileKey || item.url" class="attachment-list__file">
        <AppIcon class="attachment-list__icon" :icon="fileIcon(item)" :size="16" />
        <a
          class="attachment-list__name"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="item.filename"
        >
          {{ item.filename }}
        </a>
        <span class="attachment-list__size">{{ formatFileSize(item.size) }}</span>
      </li>
    </ul>

    <t-image-viewer
      v-model:visible="viewerVisible"
      :images="imageUrls"
      :default-index="viewerIndex"
    />
  </div>
</template>

<style scoped lang="less">
.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__thumb {
    width: 88px;
    height: 88px;
    padding: 0;
    overflow: hidden;
    cursor: zoom-in;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__files {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__file {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 4px 8px;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__icon {
    flex: none;
    color: @beacon-text-secondary;
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      color: @beacon-brand;
      text-decoration: underline;
    }
  }

  &__size {
    flex: none;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &.is-compact &__thumb {
    width: 56px;
    height: 56px;
  }
}
</style>
