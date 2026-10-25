<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UploadedObject } from '@/api/types/attachment'
import AppIcon from '@/components/AppIcon.vue'
import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { Archive02Icon, Invoice01Icon, PlusSignIcon } from '@/icons'
import {
  DEFAULT_ATTACHMENT_MAX_COUNT,
  DEFAULT_ATTACHMENT_MAX_SIZE,
  DOCUMENT_ACCEPT,
  formatFileSize,
} from '@/utils/attachment'

/**
 * 非图片附件上传（通用组件）：日志 / PDF 等文档。
 *
 * 与 ImageUploader 共用上传逻辑，只是用文件行代替缩略图；
 * 上传成功后经 v-model 输出 `UploadedObject`，点文件名可新窗口下载 / 预览。
 */
defineOptions({ name: 'AttachmentUploader' })

const model = defineModel<UploadedObject[]>({ default: () => [] })
const props = withDefaults(
  defineProps<{
    maxCount?: number
    maxSize?: number
    /** 上传目录，例如 tickets / logs；留空由后端按 users/<id> 落盘 */
    directory?: string
    disabled?: boolean
    accept?: string
  }>(),
  {
    maxCount: DEFAULT_ATTACHMENT_MAX_COUNT,
    maxSize: DEFAULT_ATTACHMENT_MAX_SIZE,
    directory: undefined,
    disabled: false,
    accept: DOCUMENT_ACCEPT,
  },
)

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)

const { uploading, remaining, canAdd, addFiles } = useAttachmentUpload({
  model,
  kind: 'document',
  maxCount: () => props.maxCount,
  maxSize: () => props.maxSize,
  directory: () => props.directory,
  disabled: () => props.disabled,
})

const hint = computed(() =>
  t('upload.fileHint', {
    size: formatFileSize(props.maxSize),
    count: props.maxCount,
  }),
)

function fileIcon(item: UploadedObject) {
  return item.mimeType === 'application/pdf' ? Invoice01Icon : Archive02Icon
}

function openPicker() {
  if (!canAdd.value) return
  inputRef.value?.click()
}

function removeAt(index: number) {
  model.value = model.value.filter((_, current) => current !== index)
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  void addFiles(input.files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragActive.value = false
  void addFiles(event.dataTransfer?.files ?? null)
}
</script>

<template>
  <div
    class="attachment-uploader"
    :class="{ 'is-dragging': dragActive, 'is-disabled': disabled }"
    @dragenter.prevent="dragActive = true"
    @dragover.prevent="dragActive = true"
    @dragleave.prevent="dragActive = false"
    @drop.prevent="onDrop"
  >
    <ul
      v-if="model.length"
      class="attachment-uploader__list"
    >
      <li
        v-for="(item, index) in model"
        :key="item.fileKey || item.url"
        class="attachment-uploader__item"
      >
        <AppIcon
          class="attachment-uploader__icon"
          :icon="fileIcon(item)"
          :size="16"
        />
        <a
          class="attachment-uploader__name"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="item.filename"
        >
          {{ item.filename }}
        </a>
        <span class="attachment-uploader__size">{{
          formatFileSize(item.size)
        }}</span>
        <t-button
          v-if="!disabled"
          variant="text"
          size="small"
          theme="danger"
          @click="removeAt(index)"
        >
          {{ t('upload.remove') }}
        </t-button>
      </li>
    </ul>

    <button
      v-if="!disabled && remaining > 0"
      type="button"
      class="attachment-uploader__add"
      :disabled="!canAdd"
      @click="openPicker"
    >
      <t-loading
        v-if="uploading"
        size="16px"
      />
      <AppIcon
        v-else
        :icon="PlusSignIcon"
        :size="16"
      />
      <span>{{
        uploading ? t('upload.uploading') : t('upload.selectFile')
      }}</span>
      <span class="attachment-uploader__drop">{{ t('upload.dropHint') }}</span>
    </button>

    <p class="attachment-uploader__hint">{{ hint }}</p>

    <input
      ref="inputRef"
      class="attachment-uploader__input"
      type="file"
      :accept="accept"
      multiple
      @change="onChange"
    />
  </div>
</template>

<style scoped lang="less">
.attachment-uploader {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
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

  &__add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    cursor: pointer;
    background: @beacon-bg-page;
    border: 1px dashed @beacon-border;
    border-radius: @beacon-radius-m;

    &:hover:not(:disabled) {
      color: @beacon-brand;
      border-color: @beacon-brand;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  &__drop {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &__hint {
    margin: 0;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &__input {
    display: none;
  }

  &.is-dragging &__add {
    color: @beacon-brand;
    border-color: @beacon-brand;
  }
}
</style>
