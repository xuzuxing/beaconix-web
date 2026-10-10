<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { Cancel01Icon, StarIcon } from '@/icons'

/** 页面标题栏右侧的「评价当页体验」卡片 */
defineOptions({ name: 'PageRating' })

const { t } = useI18n()
</script>

<template>
  <div class="page-rating">
    <span class="page-rating__label">{{ t('layout.rating') }}</span>
    <span class="page-rating__stars">
      <AppIcon v-for="n in 5" :key="n" class="page-rating__star" :icon="StarIcon" :size="14" />
    </span>
    <AppIcon class="page-rating__close" :icon="Cancel01Icon" :size="14" />
  </div>
</template>

<style scoped lang="less">
.page-rating {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 12px;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;
  border-radius: @beacon-radius-m;

  &__label {
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__stars {
    display: inline-flex;
    gap: 2px;
  }

  &__star {
    color: @beacon-border-strong;
  }

  &__close {
    color: @beacon-text-tertiary;
    cursor: pointer;
  }
}
</style>
