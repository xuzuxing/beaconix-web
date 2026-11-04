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
  <section class="breadcrumbs">
    <h2>{{ t('rum.breadcrumbs') }}</h2>
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
  </section>
</template>

<style scoped>
.breadcrumbs {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 10px;
  background: var(--td-bg-color-container);
}

.breadcrumbs h2 {
  margin-top: 0;
}

.breadcrumbs ol {
  display: grid;
  gap: 14px;
  margin: 0;
  padding-left: 22px;
}

.breadcrumbs li {
  min-width: 0;
  padding-left: 4px;
}

.breadcrumbs__heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.breadcrumbs__heading span {
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.breadcrumbs pre {
  margin: 8px 0 0;
  padding: 10px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);
}
</style>
