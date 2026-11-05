<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RumBreadcrumb } from '@/api/types/rum'

defineProps<{ breadcrumbs: RumBreadcrumb[] }>()
const { t } = useI18n()

function formatData(data?: Record<string, unknown>) {
  return data ? JSON.stringify(data, null, 2) : ''
}
</script>

<template>
  <t-card class="rum-breadcrumbs">
    <template #title>{{ t('rum.breadcrumbs') }}</template>
    <template #actions>
      <span class="rum-breadcrumbs__total">{{ breadcrumbs.length }}</span>
    </template>
    <t-empty
      v-if="!breadcrumbs.length"
      :description="t('rum.empty')"
    />
    <ol
      v-else
      class="rum-breadcrumbs__list"
    >
      <li
        v-for="(breadcrumb, index) in breadcrumbs"
        :key="`${breadcrumb.occurredAt}-${index}`"
        class="rum-breadcrumbs__item"
      >
        <div class="rum-breadcrumbs__heading">
          <strong>{{ breadcrumb.type }}</strong>
          <span class="rum-breadcrumbs__meta"
            >{{ breadcrumb.category || '—' }} ·
            {{ breadcrumb.occurredAt }}</span
          >
        </div>
        <pre
          v-if="breadcrumb.data"
          class="rum-breadcrumbs__code"
          >{{ formatData(breadcrumb.data) }}</pre>
      </li>
    </ol>
  </t-card>
</template>

<style scoped lang="less">
.rum-breadcrumbs {
  min-width: 0;

  &__total {
    color: @beacon-text-secondary;
    font-variant-numeric: tabular-nums;
  }

  &__list {
    display: grid;
    gap: @beacon-gap-l;
  }

  &__item {
    min-width: 0;
    padding-left: @beacon-gap-l;
    border-left: 2px solid @beacon-border;
  }

  &__heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: @beacon-gap;
  }

  &__meta {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__code {
    margin: 8px 0 0;
    padding: @beacon-gap;
    overflow: auto;
    font-family: @beacon-font-family-code;
    font-size: @beacon-font-size-base;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background-color: @beacon-bg-active;
  }
}
</style>
