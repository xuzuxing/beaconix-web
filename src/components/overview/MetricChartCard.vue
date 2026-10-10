<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { InformationCircleIcon } from '@/icons'

import LineChart from './LineChart.vue'

/** 数据概览里的单个指标卡片：标题 + 提示 + 折线图 */
defineOptions({ name: 'MetricChartCard' })

defineProps<{
  title: string
  tip?: string
  values: (number | null)[]
  labels: string[]
  /** 以数据最小值附近的整刻度为基线（可用率等高位窄幅波动指标） */
  autoScale?: boolean
}>()
</script>

<template>
  <div class="metric-card">
    <div class="metric-card__head">
      <span class="metric-card__title">{{ title }}</span>
      <t-tooltip v-if="tip" :content="tip" placement="top">
        <AppIcon class="metric-card__tip" :icon="InformationCircleIcon" />
      </t-tooltip>
    </div>

    <div class="metric-card__body">
      <LineChart :values="values" :labels="labels" :auto-scale="autoScale" />
    </div>
  </div>
</template>

<style scoped lang="less">
.metric-card {
  display: flex;
  flex-direction: column;
  height: 232px;
  padding: 16px;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  &__head {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
  }

  &__title {
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__tip {
    color: @beacon-text-tertiary;
    cursor: help;
  }

  &__body {
    flex: 1;
    min-height: 0;
  }
}
</style>
