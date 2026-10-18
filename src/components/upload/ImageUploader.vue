<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UploadedObject } from '@/api/types/attachment'
import AppIcon from '@/components/AppIcon.vue'
import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { Delete02Icon, PlusSignIcon } from '@/icons'
import {
  DEFAULT_ATTACHMENT_MAX_COUNT,
  DEFAULT_ATTACHMENT_MAX_SIZE,
  IMAGE_ACCEPT,
  formatFileSize,
} from '@/utils/attachment'

/**
 * 图片上传（通用组件）。
 *
 * 缩略图网格 + 拖拽 / 点选上传 + 点击预览 + 删除；上传成功后经 v-model 输出
 * `UploadedObject`（含 fileKey / url / size），业务侧自行保存需要的字段。
 * 支持单图（single）与多图，数量与大小由 props 控制，默认 5 张 / 每张 5MB。
 */
defineOptions({ name: 'ImageUploader' })

const model = defineModel<UploadedObject[]>({ default: () => [] })
const props = withDefaults(
  defineProps<{
    maxCount?: number
    maxSize?: number
    /** 上传目录，例如 tickets / avatars；留空由后端按 users/<id> 落盘 */
    directory?: string
    disabled?: boolean
    accept?: string
    /** 单图模式：只保留最新一张 */
    single?: boolean
    /** 缩略图网格的最大宽度：数字按 px 处理，也可传 '100%' 等 CSS 值；默认 480 */
    maxWidth?: number | string
  }>(),
  {
    maxCount: DEFAULT_ATTACHMENT_MAX_COUNT,
    maxSize: DEFAULT_ATTACHMENT_MAX_SIZE,
    directory: undefined,
    disabled: false,
    accept: IMAGE_ACCEPT,
    single: false,
    maxWidth: 480,
  },
)

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
const viewerVisible = ref(false)
const viewerIndex = ref(0)

const effectiveMaxCount = computed(() => (props.single ? 1 : props.maxCount))

const { uploading, remaining, canAdd, addFiles } = useAttachmentUpload({
  model,
  kind: 'image',
  maxCount: () => effectiveMaxCount.value,
  maxSize: () => props.maxSize,
  directory: () => props.directory,
  disabled: () => props.disabled,
  // 单图模式允许直接换图：额度按空列表算，上传成功后只保留最新一张
  replace: () => props.single,
})

const images = computed(() => model.value.map((item) => item.url))

/** 网格宽度由 maxWidth 驱动：数字补 px，字符串（如 '100%'）原样输出 */
const gridStyle = computed(() => {
  const value = props.maxWidth
  return { maxWidth: typeof value === 'number' ? `${value}px` : value }
})

const hint = computed(() =>
  t('upload.imageHint', {
    size: formatFileSize(props.maxSize),
    count: effectiveMaxCount.value,
  }),
)

/** 单图模式已有图时按钮表示「更换」而不是「添加」 */
const addLabel = computed(() => {
  if (uploading.value) return t('upload.uploading')
  return props.single && model.value.length ? t('upload.replaceImage') : t('upload.selectImage')
})

function openPicker() {
  if (!canAdd.value) return
  inputRef.value?.click()
}

function openViewer(index: number) {
  viewerIndex.value = index
  viewerVisible.value = true
}

function removeAt(index: number) {
  model.value = model.value.filter((_, current) => current !== index)
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  void addFiles(input.files)
  // 清空后再次选择同一个文件也会触发 change
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragActive.value = false
  void addFiles(event.dataTransfer?.files ?? null)
}

/** 供外层（头像选择弹窗）判断是否正在上传，避免带着半成品提交 */
defineExpose({ uploading })
</script>

<template>
  <div
    class="image-uploader"
    :class="{ 'is-dragging': dragActive, 'is-disabled': disabled }"
    @dragenter.prevent="dragActive = true"
    @dragover.prevent="dragActive = true"
    @dragleave.prevent="dragActive = false"
    @drop.prevent="onDrop"
  >
    <div class="image-uploader__grid" :style="gridStyle">
      <figure
        v-for="(item, index) in model"
        :key="item.fileKey || item.url"
        class="image-uploader__item"
      >
        <button
          type="button"
          class="image-uploader__thumb"
          :aria-label="t('upload.preview')"
          @click="openViewer(index)"
        >
          <img :src="item.url" :alt="item.filename" loading="lazy" />
        </button>
        <button
          v-if="!disabled"
          type="button"
          class="image-uploader__remove"
          :aria-label="t('upload.remove')"
          :title="t('upload.remove')"
          @click="removeAt(index)"
        >
          <AppIcon :icon="Delete02Icon" :size="12" />
        </button>
      </figure>

      <button
        v-if="!disabled && remaining > 0"
        type="button"
        class="image-uploader__add"
        :disabled="!canAdd"
        @click="openPicker"
      >
        <t-loading v-if="uploading" size="16px" />
        <AppIcon v-else :icon="PlusSignIcon" :size="18" />
        <span>{{ addLabel }}</span>
      </button>
    </div>

    <p class="image-uploader__hint">{{ hint }}</p>

    <input
      ref="inputRef"
      class="image-uploader__input"
      type="file"
      :accept="accept"
      :multiple="!single"
      @change="onChange"
    />

    <t-image-viewer v-model:visible="viewerVisible" :images="images" :default-index="viewerIndex" />
  </div>
</template>

<style scoped lang="less">
.image-uploader {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }

  &__item {
    position: relative;
    aspect-ratio: 1;
    margin: 0;
    overflow: hidden;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__thumb {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: zoom-in;
    background: transparent;
    border: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__remove {
    position: absolute;
    top: 4px;
    right: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    color: var(--td-text-color-anti);
    cursor: pointer;
    background-color: rgb(0 0 0 / 45%);
    border: 0;
    border-radius: 50%;

    &:hover {
      background-color: rgb(0 0 0 / 65%);
    }
  }

  &__add {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    aspect-ratio: 1;
    padding: 8px;
    font-family: inherit;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    text-align: center;
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

  &__hint {
    margin: 0;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &__input {
    display: none;
  }

  &.is-dragging &__grid {
    outline: 1px dashed @beacon-brand;
    outline-offset: 4px;
  }

  &.is-dragging &__add {
    color: @beacon-brand;
    border-color: @beacon-brand;
  }
}
</style>
