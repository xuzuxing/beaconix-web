<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RumErrorGroup } from '@/api/types/rum'

const props = defineProps<{ error: RumErrorGroup }>()
const { t } = useI18n()
const originalStack = shallowRef(false)
const visibleStack = computed(() =>
  originalStack.value
    ? props.error.stack
    : props.error.resolvedStack || props.error.stack,
)
const facts = computed(() => [
  { key: 'count', label: t('rum.count'), value: String(props.error.count) },
  {
    key: 'release',
    label: t('rum.release'),
    value: props.error.release || '—',
  },
  {
    key: 'firstSeen',
    label: t('rum.firstSeen'),
    value: props.error.firstSeenAt,
  },
  { key: 'lastSeen', label: t('rum.lastSeen'), value: props.error.lastSeenAt },
  { key: 'page', label: t('rum.page'), value: props.error.page || '—' },
  {
    key: 'session',
    label: t('rum.sessionKey'),
    value: props.error.replaySessionId || '—',
  },
])
</script>

<template>
  <t-card class="rum-error-summary">
    <template #title>{{ t('rum.errorMessage') }}</template>
    <template #actions>
      <div class="rum-error-summary__tags">
        <t-tag
          theme="danger"
          variant="light"
          >{{ error.level || 'ERROR' }}</t-tag
        >
        <t-tag variant="outline">{{ error.type }}</t-tag>
      </div>
    </template>
    <p class="rum-error-summary__message">{{ error.message }}</p>
    <dl class="rum-error-summary__facts">
      <div
        v-for="fact in facts"
        :key="fact.key"
        class="rum-error-summary__fact"
      >
        <dt>{{ fact.label }}</dt>
        <dd>{{ fact.value }}</dd>
      </div>
    </dl>
    <div class="rum-error-summary__stack-head">
      <h3 class="rum-error-summary__stack-title">
        {{ t('rum.stack') }}
        <span class="rum-error-summary__muted">{{
          t(error.sourceMapApplied ? 'rum.mapped' : 'rum.notMapped')
        }}</span>
      </h3>
      <t-radio-group
        v-model="originalStack"
        variant="default-filled"
        size="small"
      >
        <t-radio-button :value="false">{{ t('rum.resolved') }}</t-radio-button>
        <t-radio-button :value="true">{{ t('rum.original') }}</t-radio-button>
      </t-radio-group>
    </div>
    <pre class="rum-error-summary__code">{{ visibleStack || '—' }}</pre>
  </t-card>
</template>

<style scoped lang="less">
.rum-error-summary {
  min-width: 0;

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__message {
    margin: 0 0 @beacon-gap-l;
    overflow-wrap: anywhere;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: @beacon-gap-l;
    margin: 0 0 @beacon-gap-l;
  }

  &__fact {
    min-width: 0;
    padding: @beacon-gap-l;
    background-color: @beacon-bg-active;

    dt {
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 6px 0 0;
      overflow-wrap: anywhere;
      font-variant-numeric: tabular-nums;
    }
  }

  &__stack-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @beacon-gap-l;
    flex-wrap: wrap;
    margin-bottom: @beacon-gap;
  }

  &__stack-title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__muted {
    margin-left: 8px;
    font-size: @beacon-font-size-base;
    font-weight: 400;
    color: @beacon-text-tertiary;
  }

  &__code {
    max-height: 420px;
    margin: 0;
    padding: @beacon-gap-l;
    overflow: auto;
    font-family: @beacon-font-family-code;
    font-size: @beacon-font-size-base;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background-color: @beacon-bg-active;
  }

  @media (max-width: 820px) {
    &__facts {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
