<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RumErrorOccurrence } from '@/api/types/rum'

const props = defineProps<{ occurrence: RumErrorOccurrence }>()
const { t } = useI18n()
const contextSections = computed(() =>
  [
    ['HTTP', props.occurrence.http],
    ['Resource', props.occurrence.resource],
    ['Vue', props.occurrence.vue],
    ['SDK', props.occurrence.sdk],
  ].filter((entry): entry is [string, Record<string, unknown>] =>
    Boolean(entry[1]),
  ),
)

function formatData(data: Record<string, unknown>) {
  return JSON.stringify(data, null, 2)
}
</script>

<template>
  <section class="context">
    <header>
      <div>
        <p>{{ occurrence.category }} · {{ occurrence.level }}</p>
        <h2>{{ t('rum.occurrenceContext') }}</h2>
      </div>
      <span>{{ occurrence.occurredAt || occurrence.receivedAt }}</span>
    </header>

    <dl>
      <div>
        <dt>{{ t('rum.sessionId') }}</dt>
        <dd>{{ occurrence.sessionId || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.actor') }}</dt>
        <dd>{{ occurrence.endUserId || occurrence.anonymousId || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.requestId') }}</dt>
        <dd>{{ occurrence.requestId || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.clientEventId') }}</dt>
        <dd>{{ occurrence.clientEventId || '—' }}</dd>
      </div>
    </dl>

    <div
      v-if="contextSections.length"
      class="context__sections"
    >
      <article
        v-for="section in contextSections"
        :key="section[0]"
      >
        <h3>{{ section[0] }}</h3>
        <pre>{{ formatData(section[1]) }}</pre>
      </article>
    </div>

    <details v-if="occurrence.stack">
      <summary>{{ t('rum.stack') }}</summary>
      <pre>{{ occurrence.resolvedStack || occurrence.stack }}</pre>
      <h3 v-if="occurrence.resolvedStack">{{ t('rum.original') }}</h3>
      <pre v-if="occurrence.resolvedStack">{{ occurrence.stack }}</pre>
    </details>
  </section>
</template>

<style scoped>
.context {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 10px;
  background: var(--td-bg-color-container);
}

.context header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.context header p,
.context header h2 {
  margin: 0;
}

.context header p,
.context header > span,
.context dt {
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.context dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 18px 0;
}

.context dl div {
  min-width: 0;
  padding: 10px;
  border-radius: 7px;
  background: var(--td-bg-color-secondarycontainer);
}

.context dd {
  margin: 5px 0 0;
  overflow-wrap: anywhere;
}

.context__sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.context__sections article {
  min-width: 0;
}

.context h3 {
  margin: 0 0 6px;
  font-size: 14px;
}

.context pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 7px;
  background: var(--td-bg-color-secondarycontainer);
}

.context details {
  margin-top: 16px;
}

.context details pre,
.context details h3 {
  margin-top: 10px;
}

@media (max-width: 820px) {
  .context dl,
  .context__sections {
    grid-template-columns: 1fr;
  }
}
</style>
