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
const facts = computed(() => [
  {
    key: 'session',
    label: t('rum.sessionId'),
    value: props.occurrence.sessionId || '—',
  },
  {
    key: 'actor',
    label: t('rum.actor'),
    value: props.occurrence.endUserId || props.occurrence.anonymousId || '—',
  },
  {
    key: 'request',
    label: t('rum.requestId'),
    value: props.occurrence.requestId || '—',
  },
  {
    key: 'client',
    label: t('rum.clientEventId'),
    value: props.occurrence.clientEventId || '—',
  },
])

function formatData(data: Record<string, unknown>) {
  return JSON.stringify(data, null, 2)
}
</script>

<template>
  <t-card class="rum-context">
    <template #title>{{ t('rum.occurrenceContext') }}</template>
    <template #actions>
      <span class="rum-context__muted">
        {{ occurrence.category }} · {{ occurrence.level }} ·
        {{ occurrence.occurredAt || occurrence.receivedAt }}
      </span>
    </template>
    <dl class="rum-context__facts">
      <div
        v-for="fact in facts"
        :key="fact.key"
        class="rum-context__fact"
      >
        <dt>{{ fact.label }}</dt>
        <dd>{{ fact.value }}</dd>
      </div>
    </dl>
    <div
      v-if="contextSections.length"
      class="rum-context__sections"
    >
      <section
        v-for="section in contextSections"
        :key="section[0]"
        class="rum-context__section"
      >
        <h3 class="rum-context__title">{{ section[0] }}</h3>
        <pre class="rum-context__code">{{ formatData(section[1]) }}</pre>
      </section>
    </div>
    <section
      v-if="occurrence.stack"
      class="rum-context__stack"
    >
      <h3 class="rum-context__title">{{ t('rum.stack') }}</h3>
      <pre class="rum-context__code">{{
        occurrence.resolvedStack || occurrence.stack
      }}</pre>
      <template v-if="occurrence.resolvedStack">
        <h3 class="rum-context__title">{{ t('rum.original') }}</h3>
        <pre class="rum-context__code">{{ occurrence.stack }}</pre>
      </template>
    </section>
  </t-card>
</template>

<style scoped lang="less">
.rum-context {
  min-width: 0;

  &__muted {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: @beacon-gap;
    margin: 0 0 @beacon-gap-l;
  }

  &__fact {
    min-width: 0;
    padding: @beacon-gap;
    background-color: @beacon-bg-active;

    dt {
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 5px 0 0;
      overflow-wrap: anywhere;
    }
  }

  &__sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: @beacon-gap;
  }

  &__section,
  &__stack {
    min-width: 0;
  }

  &__stack {
    margin-top: @beacon-gap-l;
  }

  &__title {
    margin: 0 0 6px;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__stack &__title:not(:first-child) {
    margin-top: @beacon-gap-l;
  }

  &__code {
    max-height: 320px;
    margin: 0;
    padding: @beacon-gap;
    overflow: auto;
    font-family: @beacon-font-family-code;
    font-size: @beacon-font-size-base;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background-color: @beacon-bg-active;
  }

  @media (max-width: 820px) {
    &__facts,
    &__sections {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
