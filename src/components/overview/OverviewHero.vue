<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import PageRating from '@/components/PageRating.vue'

/** 概览页头部：欢迎标题 + 右侧评价卡 */
defineOptions({ name: 'OverviewHero' })

const { t } = useI18n()
</script>

<template>
  <div class="hero">
    <h2 class="hero__title">
      <span class="hero__wave">👋</span>
      {{ t('overview.hero.welcome') }}
    </h2>

    <PageRating />
  </div>
</template>

<style scoped lang="less">
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: @beacon-gap-l;

  &__title {
    display: flex;
    align-items: center;
    margin: 0;
    font-size: @beacon-font-size-title;
    font-weight: @beacon-font-weight-medium;
    line-height: 32px;
    color: @beacon-text-primary;
  }

  &__wave {
    margin-right: 10px;
    font-size: 26px;
    line-height: 1;
  }
}
</style>
