<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import type { RumApp } from '@/api/types/rum'
const props = defineProps<{ app: RumApp }>()
const { t } = useI18n()
const origin = ref('')
const snippet = computed(
  () =>
    `import { initRum } from './lib/beaconix-rum'\n\nconst rum = initRum({\n  endpoint: ${JSON.stringify((origin.value.trim().replace(/\/$/, '') || 'https://your-api.example.com') + '/api/rum')},\n  publicKey: ${JSON.stringify(props.app.publicKey)},\n  release: 'web-release-1',\n  sessionReplay: { enabled: false, maskText: true },\n})\n\nvoid rum.captureEvent('checkout_completed', { plan: 'pro' })`,
)
async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    void MessagePlugin.success(t('rum.copied'))
  } catch {
    void MessagePlugin.error(t('rum.failed'))
  }
}
</script>
<template>
  <t-card class="rum-setup">
    <template #title>{{ t('rum.setup') }}</template>
    <div class="rum-setup__body">
      <div class="rum-setup__row">
        <span class="rum-setup__label">{{ t('rum.publicKey') }}</span>
        <code class="rum-setup__key">{{ app.publicKey }}</code>
        <t-button
          variant="text"
          @click="copy(app.publicKey)"
          >{{ t('rum.copy') }}</t-button
        >
      </div>
      <p class="rum-setup__hint">{{ t('rum.apiHint') }}</p>
      <label class="rum-setup__field"
        >{{ t('rum.apiOrigin') }}
        <t-input
          v-model="origin"
          placeholder="https://api.example.com"
      /></label>
      <p class="rum-setup__hint">{{ t('rum.sdkGuide') }}</p>
      <t-alert
        theme="warning"
        :message="t('rum.privacy')"
      />
      <pre class="rum-setup__code">{{ snippet }}</pre>
      <t-button
        variant="outline"
        @click="copy(snippet)"
        >{{ t('rum.copy') }}</t-button
      >
    </div>
  </t-card>
</template>
<style scoped lang="less">
.rum-setup {
  min-width: 0;

  &__body {
    display: grid;
    gap: @beacon-gap-l;
    justify-items: start;
    max-width: 900px;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: @beacon-gap;
  }

  &__label {
    color: @beacon-text-secondary;
  }

  &__key {
    font-family: @beacon-font-family-code;
    overflow-wrap: anywhere;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-secondary;
  }

  &__field {
    display: grid;
    gap: 8px;
    width: 100%;
    color: @beacon-text-secondary;
  }

  &__code {
    width: 100%;
    margin: 0;
    padding: @beacon-gap-l;
    overflow: auto;
    font-family: @beacon-font-family-code;
    font-size: @beacon-font-size-base;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background-color: @beacon-bg-active;
  }
}
</style>
