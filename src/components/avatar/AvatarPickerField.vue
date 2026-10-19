<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AvatarPickerDialog from '@/components/avatar/AvatarPickerDialog.vue'

/**
 * 头像 / Logo 的单入口字段：一个静态预览框，点击后打开选择弹窗。
 *
 * 框里只负责展示当前地址；随机头像候选、预览与上传都在弹窗内，
 * 因此表单侧不必再内嵌上传组件，一个入口既可选随机头像也能自己上传。
 */
defineOptions({ name: 'AvatarPickerField' })

const model = defineModel<string>({ default: '' })
const props = withDefaults(
  defineProps<{
    /** 上传目录，例如 avatars / teams */
    directory?: string
    maxSize?: number
    disabled?: boolean
    /** 预览框边长（px），默认 96 */
    size?: number
  }>(),
  {
    directory: 'avatars',
    maxSize: 2 * 1024 * 1024,
    disabled: false,
    size: 96,
  },
)

const { t } = useI18n()
const visible = ref(false)

function open() {
  if (props.disabled) return
  visible.value = true
}
</script>

<template>
  <div class="avatar-field">
    <button
      type="button"
      class="avatar-field__box"
      :class="{ 'is-empty': !model }"
      :style="{ width: `${size}px`, height: `${size}px` }"
      :disabled="disabled"
      :aria-label="t('workspace.avatar.change')"
      @click="open"
    >
      <img
        v-if="model"
        class="avatar-field__image"
        :src="model"
        alt=""
      />
      <span
        v-else
        class="avatar-field__empty"
        >{{ t('workspace.avatar.emptyHint') }}</span
      >
    </button>

    <AvatarPickerDialog
      v-model:visible="visible"
      v-model="model"
      :directory="directory"
      :max-size="maxSize"
    />
  </div>
</template>

<style scoped lang="less">
.avatar-field {
  display: flex;

  &__box {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;
    cursor: pointer;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    &:hover:not(:disabled) {
      border-color: @beacon-brand;
    }

    &.is-empty {
      border-style: dashed;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  &__image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* 像素风的 logo 放大后保持硬边 */
    image-rendering: pixelated;
  }

  &__empty {
    padding: 0 8px;
    font-size: @beacon-font-size-caption;
    line-height: 1.5;
    color: @beacon-text-tertiary;
    text-align: center;
  }
}
</style>
