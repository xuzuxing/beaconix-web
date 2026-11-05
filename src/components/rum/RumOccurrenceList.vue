<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RumPage, RumErrorOccurrence } from '@/api/types/rum'
import RumPager from './RumPager.vue'

const page = defineModel<number>({ required: true })
defineProps<{
  data: RumPage<RumErrorOccurrence> | null
  selectedId: string | null
}>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <t-card class="occurrences">
    <template #title>{{ t('rum.occurrences') }}</template>
    <template #actions>
      <span class="occurrences__hint">{{ t('rum.occurrencesHint') }}</span>
      <t-tag
        variant="outline"
        size="small"
        >{{ data?.total ?? 0 }}</t-tag
      >
    </template>

    <t-empty
      v-if="!data?.items.length"
      :description="t('rum.empty')"
    />
    <div
      v-else
      class="occurrences__list"
    >
      <button
        v-for="item in data.items"
        :key="item.id"
        type="button"
        class="occurrences__item"
        :class="{ 'occurrences__item--selected': item.id === selectedId }"
        @click="emit('select', item.id)"
      >
        <span class="occurrences__item-topline">
          <strong>{{ item.category }}</strong>
          <t-tag
            size="small"
            :theme="item.level === 'FATAL' ? 'danger' : 'warning'"
          >
            {{ item.level }}
          </t-tag>
        </span>
        <span>{{ item.occurredAt || item.receivedAt }}</span>
        <span>{{ item.page || '—' }}</span>
        <span>{{ item.requestId || item.clientEventId || '—' }}</span>
      </button>
    </div>

    <RumPager
      v-if="data"
      v-model="page"
      :total="data.total"
      :limit="data.limit"
    />
  </t-card>
</template>

<style scoped lang="less">
.occurrences {
  min-width: 0;

  &__hint {
    margin-right: 8px;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }

  &__list {
    margin-top: 4px;
    border-top: 1px solid @beacon-border;
  }

  &__item {
    display: grid;
    gap: 6px;
    width: 100%;
    padding: 12px 10px;
    border: 0;
    border-bottom: 1px solid @beacon-border;
    border-left: 2px solid transparent;
    color: inherit;
    text-align: left;
    background: transparent;
    cursor: pointer;

    &:hover {
      background: @beacon-bg-page;
    }

    &--selected {
      border-left-color: @beacon-brand;
      background: @beacon-brand-light;
    }
  }

  &__item-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__item > span:not(.occurrences__item-topline) {
    overflow-wrap: anywhere;
    color: @beacon-text-secondary;
    font-size: 12px;
  }
}
</style>
