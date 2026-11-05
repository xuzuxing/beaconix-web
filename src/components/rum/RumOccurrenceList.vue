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
  <t-card class="rum-occurrences">
    <template #title>{{ t('rum.occurrences') }}</template>
    <template #actions>
      <span class="rum-occurrences__total">{{ data?.total ?? 0 }}</span>
    </template>
    <p class="rum-occurrences__hint">{{ t('rum.occurrencesHint') }}</p>
    <t-empty
      v-if="!data?.items.length"
      :description="t('rum.empty')"
    />
    <div
      v-else
      class="rum-occurrences__list"
    >
      <button
        v-for="item in data.items"
        :key="item.id"
        type="button"
        class="rum-occurrences__item"
        :class="{ 'is-selected': item.id === selectedId }"
        @click="emit('select', item.id)"
      >
        <span class="rum-occurrences__topline">
          <strong class="rum-occurrences__category">{{ item.category }}</strong>
          <t-tag
            size="small"
            variant="light"
            :theme="item.level === 'FATAL' ? 'danger' : 'warning'"
          >
            {{ item.level }}
          </t-tag>
        </span>
        <span class="rum-occurrences__meta">{{
          item.occurredAt || item.receivedAt
        }}</span>
        <span class="rum-occurrences__meta">{{ item.page || '—' }}</span>
        <span class="rum-occurrences__meta">{{
          item.requestId || item.clientEventId || '—'
        }}</span>
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
.rum-occurrences {
  min-width: 0;

  &__total {
    color: @beacon-text-secondary;
    font-variant-numeric: tabular-nums;
  }

  &__hint {
    margin: 0 0 @beacon-gap-l;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__list {
    display: grid;
    gap: @beacon-gap;
  }

  &__item {
    display: grid;
    gap: 6px;
    width: 100%;
    padding: @beacon-gap;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    text-align: left;
    cursor: pointer;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;

    &:hover {
      background-color: @beacon-bg-hover;
    }

    &.is-selected {
      border-color: @beacon-brand;
      background-color: @beacon-brand-light;
    }
  }

  &__topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @beacon-gap;
  }

  &__category {
    overflow-wrap: anywhere;
  }

  &__meta {
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }
}
</style>
