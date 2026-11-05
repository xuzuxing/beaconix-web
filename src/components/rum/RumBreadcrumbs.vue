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
  <t-card class="breadcrumbs">
    <template #title>{{ t('rum.breadcrumbs') }}</template>
    <template #actions>
      <t-tag
        variant="outline"
        size="small"
        >{{ breadcrumbs.length }}</t-tag
      >
    </template>
    <t-empty
      v-if="!breadcrumbs.length"
      :description="t('rum.empty')"
    />
    <ol v-else>
      <li
        v-for="(breadcrumb, index) in breadcrumbs"
        :key="`${breadcrumb.occurredAt}-${index}`"
      >
        <div class="breadcrumbs__heading">
          <strong>{{ breadcrumb.type }}</strong>
          <span
            >{{ breadcrumb.category || '—' }} ·
            {{ breadcrumb.occurredAt }}</span
          >
        </div>
        <pre v-if="breadcrumb.data">{{ formatData(breadcrumb.data) }}</pre>
      </li>
    </ol>
  </t-card>
</template>

<style scoped lang="less">
.breadcrumbs {
  min-width: 0;

  ol {
    display: grid;
    gap: 14px;
    margin: 0;
    padding-left: 22px;
  }

  li {
    min-width: 0;
    padding-left: 4px;
  }

  &__heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;

    span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }

  pre {
    margin: 8px 0 0;
    padding: 10px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    border: 1px solid @beacon-border;
    background: @beacon-bg-page;
    font-family: @beacon-font-family-code;
    font-size: 12px;
  }
}
</style>
