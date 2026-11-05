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

const sdk = computed(() => props.occurrence.sdk ?? {})

function pick(keys: string[]) {
  for (const key of keys) {
    const value = sdk.value[key]
    if (typeof value === 'string' && value) return value
  }
  return '—'
}

const environment = computed(() => [
  { key: 'device', value: pick(['device', 'deviceType', 'deviceModel']) },
  { key: 'browser', value: pick(['browser', 'browserName']) },
  { key: 'operatingSystem', value: pick(['os', 'osName', 'platform']) },
  { key: 'userAgent', value: pick(['userAgent', 'ua']) },
])

const tags = computed(() => {
  const raw = sdk.value.tags
  if (Array.isArray(raw)) return raw.map((value) => String(value))
  if (typeof raw === 'string' && raw) return [raw]
  return []
})

function formatData(data: Record<string, unknown>) {
  return JSON.stringify(data, null, 2)
}
</script>

<template>
  <t-card class="context">
    <header>
      <div>
        <p>{{ occurrence.category }} · {{ occurrence.level }}</p>
        <h2>{{ t('rum.occurrenceContext') }}</h2>
      </div>
      <span>{{ occurrence.occurredAt || occurrence.receivedAt }}</span>
    </header>

    <dl class="context__facts">
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

    <dl class="context__facts context__facts--environment">
      <div
        v-for="item in environment"
        :key="item.key"
      >
        <dt>{{ t(`rum.${item.key}`) }}</dt>
        <dd>{{ item.value }}</dd>
      </div>
    </dl>

    <div
      v-if="tags.length"
      class="context__tags"
    >
      <span>{{ t('rum.tags') }}</span>
      <t-tag
        v-for="tag in tags"
        :key="tag"
        size="small"
        variant="light"
        >{{ tag }}</t-tag
      >
    </div>

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
  </t-card>
</template>

<style scoped lang="less">
.context {
  min-width: 0;

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  header p,
  header h2 {
    margin: 0;
  }

  header h2 {
    margin-top: 4px;
    font-size: 16px;
    font-weight: @beacon-font-weight-medium;
  }

  header p,
  header > span,
  dt {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;
    margin: 18px 0;
    padding-bottom: 16px;
    border-bottom: 1px solid @beacon-border;

    div {
      min-width: 0;
    }

    dt {
      margin-bottom: 5px;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 13px;
    }

    &--environment {
      margin-top: 0;
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;

    > span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }

  &__sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  &__sections article {
    min-width: 0;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 14px;
  }

  pre {
    margin: 0;
    padding: 12px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    border: 1px solid @beacon-border;
    background: @beacon-bg-page;
    font-family: @beacon-font-family-code;
    font-size: 12px;
  }

  details {
    margin-top: 16px;
  }

  details pre,
  details h3 {
    margin-top: 10px;
  }
}

@media (max-width: 820px) {
  .context__facts,
  .context__sections {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
