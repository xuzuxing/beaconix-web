<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { InformationCircleIcon } from '@/icons'

/** 图表卡片外壳：标题 + 提示 + 右上角补充信息，样式与 MetricChartCard 一致 */
defineOptions({ name: 'ChartCard' })

withDefaults(
  defineProps<{
    title: string
    /** 标题右侧的问号提示 */
    tip?: string
    /** 右上角的补充信息（当前值、单位等） */
    extra?: string
    height?: string
  }>(),
  { height: '240px' },
)
</script>

<template>
  <section class="chart-card" :style="{ height }">
    <header class="chart-card__head">
      <div class="chart-card__titles">
        <span class="chart-card__title">{{ title }}</span>
        <t-tooltip v-if="tip" :content="tip" placement="top">
          <AppIcon class="chart-card__tip" :icon="InformationCircleIcon" />
        </t-tooltip>
      </div>
      <span v-if="extra" class="chart-card__extra">{{ extra }}</span>
    </header>

    <div class="chart-card__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="less">
.chart-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  &__head {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__titles {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  &__title {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tip {
    color: @beacon-text-tertiary;
    cursor: help;
  }

  &__extra {
    flex: none;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__body {
    flex: 1;
    min-height: 0;
  }
}
</style>
