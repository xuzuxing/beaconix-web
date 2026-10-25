<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { AppWindowIcon } from '@/icons'

/** 尚未接入的模块统一使用这个占位页，保证菜单与路由可用 */
defineOptions({ name: 'PlaceholderView' })

const { t } = useI18n()
</script>

<template>
  <t-card :bordered="false">
    <div class="placeholder">
      <AppIcon
        class="placeholder__icon"
        :icon="AppWindowIcon"
        :size="40"
      />
      <p class="placeholder__title">{{ t('placeholder.title') }}</p>
      <p class="placeholder__desc">{{ t('placeholder.desc') }}</p>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 0;

  &__icon {
    color: @beacon-text-disabled;
  }

  &__title {
    margin: 8px 0 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__desc {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
