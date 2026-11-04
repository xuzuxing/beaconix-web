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
  <section class="occurrences">
    <header class="occurrences__header">
      <div>
        <h2>{{ t('rum.occurrences') }}</h2>
        <p>{{ t('rum.occurrencesHint') }}</p>
      </div>
      <t-tag variant="outline">{{ data?.total ?? 0 }}</t-tag>
    </header>

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
  </section>
</template>

<style scoped>
.occurrences {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 10px;
  background: var(--td-bg-color-container);
}

.occurrences__header,
.occurrences__item-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.occurrences__header h2,
.occurrences__header p {
  margin: 0;
}

.occurrences__header p {
  margin-top: 4px;
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.occurrences__list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.occurrences__item {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.occurrences__item:hover,
.occurrences__item--selected {
  border-color: var(--td-brand-color);
  background: var(--td-brand-color-light);
}

.occurrences__item > span:not(.occurrences__item-topline) {
  color: var(--td-text-color-secondary);
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>
