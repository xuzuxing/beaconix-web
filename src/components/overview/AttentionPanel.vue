<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { CheckmarkCircle02Icon } from '@/icons'

/** 事项关注：提醒/活动列表 + 运行状态空态 */
defineOptions({ name: 'AttentionPanel' })

const { t } = useI18n()

const reminders = computed(() => [
  {
    key: 'suggestion',
    tag: t('overview.attention.suggestion'),
    theme: 'primary' as const,
    text: t('overview.attention.suggestionText'),
  },
  {
    key: 'activity',
    tag: t('overview.attention.activity'),
    theme: 'danger' as const,
    text: t('overview.attention.activityText'),
  },
])
</script>

<template>
  <t-card :bordered="false" class="attention">
    <div class="attention__head">
      <h3 class="attention__heading">{{ t('overview.attention.title') }}</h3>
      <t-button theme="primary" variant="text" size="small">
        {{ t('overview.attention.viewAll') }}
      </t-button>
    </div>

    <div class="attention__grid">
      <div class="attention__panel">
        <div class="attention__panel-head">
          <span class="attention__panel-title">{{ t('overview.attention.reminder') }}</span>
          <span class="attention__count">2</span>
        </div>
        <ul class="attention__list">
          <li v-for="item in reminders" :key="item.key" class="attention__item">
            <t-tag class="attention__tag" :theme="item.theme" variant="light" size="small">
              {{ item.tag }}
            </t-tag>
            <span class="attention__text">{{ item.text }}</span>
            <t-button class="attention__detail" theme="primary" variant="text" size="small">
              {{ t('overview.attention.detail') }}
            </t-button>
          </li>
        </ul>
      </div>

      <div class="attention__panel">
        <div class="attention__panel-head">
          <span class="attention__panel-title">{{ t('overview.attention.health') }}</span>
        </div>
        <div class="attention__empty">
          <div class="attention__empty-illustration">
            <AppIcon class="attention__empty-icon" :icon="CheckmarkCircle02Icon" :size="28" />
          </div>
          <span class="attention__empty-text">{{ t('overview.attention.healthy') }}</span>
        </div>
      </div>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.attention {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: @beacon-gap-l;
  }

  &__heading {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__panel {
    display: flex;
    flex-direction: column;
    min-height: 190px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__panel-head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 46px;
    padding: 0 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__panel-title {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    color: var(--td-text-color-anti);
    background-color: @beacon-error;
    border-radius: 8px;
  }

  &__list {
    display: flex;
    flex-direction: column;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
  }

  &__tag {
    flex: none;
  }

  &__text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__detail {
    flex: none;
  }

  &__empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
  }

  &__empty-illustration {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background-color: @beacon-bg-page;
  }

  &__empty-icon {
    font-size: 28px;
    color: @beacon-text-disabled;
  }

  &__empty-text {
    color: @beacon-text-tertiary;
  }
}
</style>
