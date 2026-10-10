<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import type { UsageGroup, UsageMetric } from '@/config/usage'
import {
  AiMagicIcon,
  Analytics01Icon,
  ApiIcon,
  CloudIcon,
  Database01Icon,
  Folder01Icon,
  GlobalIcon,
  type IconData,
  Layers01Icon,
  ServerIcon,
} from '@/icons'

/** 功能用量概览里的单个分组卡片：分组标题 + 消耗标签 + 3 列指标 */
defineOptions({ name: 'UsageGroupCard' })

const props = defineProps<{ group: UsageGroup }>()

const { t } = useI18n()

/** 分组图标：按分组 key 匹配，未命中时回退到「其他」图标 */
const GROUP_ICONS: Record<string, IconData> = {
  db: Database01Icon,
  functions: CloudIcon,
  container: ServerIcon,
  storage: Folder01Icon,
  ai: AiMagicIcon,
  staticHosting: GlobalIcon,
  invocation: ApiIcon,
  log: Analytics01Icon,
  other: Layers01Icon,
}

const icon = computed(() => GROUP_ICONS[props.group.key] ?? Layers01Icon)

/** 指标名：模型名等专有名词直接用 label，其余走 i18n */
function metricLabel(metric: UsageMetric) {
  return metric.label ?? (metric.labelKey ? t(metric.labelKey) : '')
}

function updateText(update: UsageMetric['update']) {
  return t(update === 'hour' ? 'usage.overview.updateHour' : 'usage.overview.updateDay')
}
</script>

<template>
  <div class="usage-group">
    <div class="usage-group__head">
      <div class="usage-group__titles">
        <AppIcon class="usage-group__icon" :icon="icon" />
        <span class="usage-group__name">{{ t(group.titleKey) }}</span>
        <span class="usage-group__cost">{{ t('usage.overview.cost', { value: group.cost }) }}</span>
      </div>
      <a class="usage-group__detail" href="#">{{ t('usage.overview.detail') }}</a>
    </div>

    <div class="usage-group__grid">
      <div v-for="(metric, index) in group.metrics" :key="index" class="usage-group__item">
        <div class="usage-group__item-head">
          <span class="usage-group__item-name">{{ metricLabel(metric) }}</span>
          <span class="usage-group__item-status">
            <button v-if="metric.detail" type="button" class="usage-group__item-detail">
              {{ t('usage.overview.itemDetail') }}
            </button>
            <span class="usage-group__item-update">{{ updateText(metric.update) }}</span>
          </span>
        </div>

        <div class="usage-group__item-value">
          <span class="usage-group__value">{{ metric.value }}</span>
          <span v-if="metric.unitKey" class="usage-group__unit">{{ t(metric.unitKey) }}</span>
          <span v-if="metric.extraKey" class="usage-group__extra">
            {{ t(metric.extraKey) }} {{ metric.extraValue }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.usage-group {
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
  }

  &__titles {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__icon {
    color: @beacon-text-secondary;
  }

  &__name {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  // 「消耗X点」：浅灰底标签
  &__cost {
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__detail {
    flex: none;
    font-size: @beacon-font-size-base;
    color: @beacon-brand;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  // 指标网格：参考实现为 24 格制的 8 格宽，即三列
  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  &__item {
    padding: 12px 16px;
    border-top: 1px solid @beacon-border;
  }

  &__item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 20px;
  }

  &__item-name {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item-status {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  &__item-detail {
    padding: 0 6px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;

    &:hover {
      color: @beacon-brand;
      border-color: @beacon-brand;
    }
  }

  &__item-update {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__item-value {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-top: 4px;
  }

  &__value {
    font-size: 20px;
    line-height: 28px;
    color: @beacon-text-primary;
  }

  &__unit {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__extra {
    margin-left: auto;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}
</style>
