<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useBrand } from '@/composables/useBrand'

/**
 * 维护模式提示条：平台配置 `system.maintenanceMode` 为 true 时显示。
 * 后端目前不拦截请求，所以这里只做提示，不阻断操作。
 */
defineOptions({ name: 'AppMaintenanceBanner' })

const { t } = useI18n()
const { maintenanceMode } = useBrand()
</script>

<template>
  <div v-if="maintenanceMode" class="maintenance-banner" role="status">
    <span class="maintenance-banner__dot" aria-hidden="true"></span>
    <span class="maintenance-banner__text">{{ t('common.maintenanceBanner') }}</span>
  </div>
</template>

<style scoped lang="less">
.maintenance-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: @beacon-font-size-base;
  color: @beacon-warning;
  /* @beacon-* 都是 CSS 变量，less 的 fade() 处理不了，用 color-mix 稀释 */
  background: color-mix(in srgb, var(--td-warning-color) 12%, transparent);
  border-bottom: 1px solid
    color-mix(in srgb, var(--td-warning-color) 30%, transparent);
}

.maintenance-banner__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: @beacon-warning;
}

.maintenance-banner__text {
  min-width: 0;
}
</style>
