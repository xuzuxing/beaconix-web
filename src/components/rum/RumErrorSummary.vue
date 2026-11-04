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
</script>

<template>
  <section class="summary-card">
    <header class="summary-card__header">
      <div>
        <p class="summary-card__eyebrow">
          {{ error.category || t('rum.unknownCategory') }}
        </p>
        <h2>{{ error.message }}</h2>
      </div>
      <div class="summary-card__tags">
        <t-tag theme="danger">{{ error.level || 'ERROR' }}</t-tag>
        <t-tag variant="outline">{{ error.type }}</t-tag>
      </div>
    </header>

    <dl class="summary-card__facts">
      <div>
        <dt>{{ t('rum.count') }}</dt>
        <dd>{{ error.count }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.release') }}</dt>
        <dd>{{ error.release || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.firstSeen') }}</dt>
        <dd>{{ error.firstSeenAt }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.lastSeen') }}</dt>
        <dd>{{ error.lastSeenAt }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.page') }}</dt>
        <dd>{{ error.page || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.sessionKey') }}</dt>
        <dd>{{ error.replaySessionId || '—' }}</dd>
      </div>
    </dl>

    <div class="summary-card__stack-heading">
      <div>
        <h3>{{ t('rum.stack') }}</h3>
        <span>{{
          t(error.sourceMapApplied ? 'rum.mapped' : 'rum.notMapped')
        }}</span>
      </div>
      <t-radio-group
        v-model="originalStack"
        variant="default-filled"
      >
        <t-radio-button :value="false">{{ t('rum.resolved') }}</t-radio-button>
        <t-radio-button :value="true">{{ t('rum.original') }}</t-radio-button>
      </t-radio-group>
    </div>
    <pre>{{ visibleStack || '—' }}</pre>
  </section>
</template>

<style scoped>
.summary-card {
  padding: 22px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 10px;
  background: var(--td-bg-color-container);
}

.summary-card__header,
.summary-card__stack-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.summary-card__header h2,
.summary-card__stack-heading h3 {
  margin: 0;
  overflow-wrap: anywhere;
}

.summary-card__eyebrow {
  margin: 0 0 6px;
  color: var(--td-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.summary-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-card__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}

.summary-card__facts div {
  min-width: 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
}

.summary-card__facts dt {
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.summary-card__facts dd {
  margin: 6px 0 0;
  overflow-wrap: anywhere;
}

.summary-card__stack-heading {
  align-items: center;
  margin-bottom: 12px;
}

.summary-card__stack-heading span {
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.summary-card pre {
  max-height: 420px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
}

@media (max-width: 820px) {
  .summary-card__header,
  .summary-card__stack-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-card__facts {
    grid-template-columns: 1fr;
  }
}
</style>
