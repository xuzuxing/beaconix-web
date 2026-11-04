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
  <section>
    <h2>{{ app.name }}</h2>
    <p>
      {{ t('rum.publicKey') }}: <code>{{ app.publicKey }}</code>
      <t-button
        variant="text"
        @click="copy(app.publicKey)"
        >{{ t('rum.copy') }}</t-button
      >
    </p>
    <p>{{ t('rum.apiHint') }}</p>
    <label
      >{{ t('rum.apiOrigin') }}
      <t-input
        v-model="origin"
        placeholder="https://api.example.com"
    /></label>
    <p>{{ t('rum.sdkGuide') }}</p>
    <t-alert
      theme="warning"
      :message="t('rum.privacy')"
    />
    <pre>{{ snippet }}</pre>
    <t-button
      variant="outline"
      @click="copy(snippet)"
      >{{ t('rum.copy') }}</t-button
    >
  </section>
</template>
<style scoped>
section {
  max-width: 900px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--td-bg-color-secondarycontainer);
  padding: 16px;
  border-radius: 6px;
}
code {
  overflow-wrap: anywhere;
}
</style>
