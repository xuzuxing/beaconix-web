<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import type { EnvItem } from '@/config/env'
import {
  CheckmarkCircle02Icon,
  CloudIcon,
  Database01Icon,
  Folder01Icon,
  MoreHorizontalIcon,
} from '@/icons'

/** 选择环境页的单个环境卡片，支持卡片 / 列表两种排布 */
defineOptions({ name: 'EnvCard' })

withDefaults(
  defineProps<{
    env: EnvItem
    selected?: boolean
    /** list 模式下卡片改为横向一行 */
    mode?: 'card' | 'list'
  }>(),
  { selected: false, mode: 'card' },
)

defineEmits<{ select: [] }>()

const { t } = useI18n()

/** 环境内的常用入口：数据库 / 云存储 / 云函数 */
const entries = computed(() => [Database01Icon, Folder01Icon, CloudIcon])
</script>

<template>
  <div
    class="env-card"
    :class="[`env-card--${mode}`, { 'is-selected': selected }]"
    role="button"
    tabindex="0"
    @click="$emit('select')"
    @keydown.enter="$emit('select')"
  >
    <div class="env-card__head">
      <span class="env-card__name">{{ env.name }}</span>
      <button type="button" class="env-card__more" :aria-label="t('layout.profile')" @click.stop>
        <AppIcon :icon="MoreHorizontalIcon" />
      </button>
    </div>

    <ul class="env-card__info">
      <li class="env-card__row">
        <span class="env-card__label">{{ t('env.envId') }}</span>
        <span class="env-card__value">{{ env.id }}</span>
      </li>
      <li class="env-card__row">
        <span class="env-card__label">{{ t('env.expiredAt') }}</span>
        <span class="env-card__value">{{ env.expiredAt }}</span>
      </li>
      <li class="env-card__row">
        <span class="env-card__tag">{{ t('env.fixedTerm') }}</span>
        <span v-if="env.tagKey" class="env-card__tag">{{ t(env.tagKey) }}</span>
      </li>
    </ul>

    <div class="env-card__foot">
      <div class="env-card__entries">
        <button
          v-for="(entry, index) in entries"
          :key="index"
          type="button"
          class="env-card__entry"
          @click.stop
        >
          <AppIcon :icon="entry" />
        </button>
      </div>

      <span class="env-card__source">{{ t('env.source') }}</span>
    </div>

    <span v-if="selected" class="env-card__check">
      <AppIcon :icon="CheckmarkCircle02Icon" :size="18" />
    </span>
  </div>
</template>

<style scoped lang="less">
.env-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  &:hover {
    border-color: @beacon-brand-hover;
  }

  &.is-selected {
    border-color: @beacon-brand;
  }

  // 列表模式：卡片改为横向一行
  &--list {
    flex-direction: row;
    align-items: center;
    gap: 24px;

    .env-card__head {
      flex: none;
      width: 200px;
    }

    .env-card__info {
      flex: 1;
      flex-direction: row;
      gap: 24px;
      min-width: 0;
    }

    .env-card__foot {
      flex: none;
    }
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__more {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: @beacon-text-tertiary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
  }

  &__label {
    flex: none;
    color: @beacon-text-tertiary;
  }

  &__value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tag {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-tertiary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__entries {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__entry {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }

  &__source {
    margin-right: 20px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  // 选中勾：右下角（与「类型来源」留出间距，避免遮挡）
  &__check {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: inline-flex;
    color: @beacon-brand;
  }
}
</style>
