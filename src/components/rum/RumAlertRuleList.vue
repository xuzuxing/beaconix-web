<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RumAlertRule } from '@/api/types/rum'

defineProps<{
  rules: RumAlertRule[]
  canManage: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  edit: [rule: RumAlertRule]
  remove: [rule: RumAlertRule]
}>()
const { t } = useI18n()
</script>

<template>
  <t-empty
    v-if="!rules.length"
    :description="t('rum.empty')"
  />
  <article
    v-for="rule in rules"
    :key="rule.id"
    class="alert-rule"
  >
    <div class="alert-rule__main">
      <strong>{{ rule.name }}</strong>
      <span
        >{{ t(`rum.alertMetric.${rule.metric}`) }} ·
        {{ t(`rum.alertScope.${rule.scope}`) }}</span
      >
      <span v-if="rule.eventName"
        >{{ t('rum.eventName') }}: {{ rule.eventName }}</span
      >
      <span v-if="rule.groupId"
        >{{ t('rum.errorGroupId') }}: {{ rule.groupId }}</span
      >
    </div>
    <div class="alert-rule__values">
      <span>{{ t('rum.threshold') }}: {{ rule.threshold }}</span>
      <span>{{ t('rum.window') }}: {{ rule.windowMinutes }}</span>
      <span>{{ t('rum.confirmWindows') }}: {{ rule.confirmWindows }}</span>
      <span>{{ t('rum.value') }}: {{ rule.lastValue }}</span>
      <span>{{ t(rule.enabled ? 'rum.enabled' : 'rum.disabled') }}</span>
      <span v-if="rule.silenceUntil"
        >{{ t('rum.silenceUntil') }}: {{ rule.silenceUntil }}</span
      >
    </div>
    <div
      v-if="canManage"
      class="alert-rule__actions"
    >
      <t-button
        variant="text"
        @click="emit('edit', rule)"
      >
        {{ t('rum.edit') }}
      </t-button>
      <t-button
        variant="text"
        theme="danger"
        :disabled="busy"
        @click="emit('remove', rule)"
      >
        {{ t('rum.remove') }}
      </t-button>
    </div>
  </article>
</template>

<style scoped>
.alert-rule {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) minmax(240px, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.alert-rule__main,
.alert-rule__values {
  display: grid;
  gap: 5px;
  overflow-wrap: anywhere;
}

.alert-rule__main span,
.alert-rule__values {
  color: var(--td-text-color-secondary);
}

.alert-rule__actions {
  display: flex;
  gap: 6px;
}

@media (max-width: 860px) {
  .alert-rule {
    grid-template-columns: 1fr;
  }
}
</style>
