<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'

import type { IconData } from '@/icons'

/**
 * 统一封装的 Hugeicons 图标。
 * 默认 16px、描边 1.5，颜色跟随 currentColor，尺寸需要时用 size 覆盖。
 */
defineOptions({ name: 'AppIcon' })

withDefaults(
  defineProps<{
    icon: IconData
    size?: number
    strokeWidth?: number
  }>(),
  { size: 16, strokeWidth: 1.5 },
)
</script>

<template>
  <HugeiconsIcon
    class="app-icon"
    :icon="icon"
    :size="size"
    color="currentColor"
    :stroke-width="strokeWidth"
  />
</template>

<style scoped lang="less">
.app-icon {
  display: inline-block;
  flex: none;
  vertical-align: middle;
}
</style>
