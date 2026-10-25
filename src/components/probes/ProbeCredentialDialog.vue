<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { useIntervalFn } from '@vueuse/core'
import AppIcon from '@/components/AppIcon.vue'
import { Copy01Icon } from '@/icons'
import { formatDateTime } from '@/utils/billing'

export interface ProbeCredential {
  value: string
  name: string
  kind: 'secret' | 'install' | 'rotate'
  probeId?: string
  expiresAt?: string
  apiUrl?: string
}
const credential = defineModel<ProbeCredential | null>('credential', {
  required: true,
})
const { t } = useI18n()
const visible = computed({
  get: () => credential.value !== null,
  set: (value) => {
    if (!value) credential.value = null
  },
})
const now = ref(Date.now())
const { pause, resume } = useIntervalFn(
  () => {
    now.value = Date.now()
  },
  1000,
  { immediate: false },
)
watch(visible, (value) => {
  now.value = Date.now()
  if (value) resume()
  else pause()
})
const expired = computed(
  () =>
    !!credential.value?.expiresAt &&
    Date.parse(credential.value.expiresAt) <= now.value,
)
async function copy() {
  const value = credential.value?.value
  if (!value || expired.value) return
  try {
    await navigator.clipboard.writeText(value)
    if (credential.value?.value === value)
      MessagePlugin.success(t('probePage.copied'))
  } catch {
    MessagePlugin.warning(t('probePage.copyFailed'))
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="
      t(
        credential?.kind === 'install'
          ? 'probePage.installTitle'
          : 'probePage.secretTitle',
      )
    "
    width="min(680px, calc(100vw - 32px))"
    :footer="false"
    destroy-on-close
  >
    <div
      v-if="credential"
      class="probe-credential"
    >
      <t-alert
        theme="warning"
        :message="
          t(
            credential.kind === 'install'
              ? 'probePage.installWarning'
              : 'probePage.secretWarning',
          )
        "
      />
      <t-alert
        v-if="credential.kind === 'rotate'"
        theme="info"
        :message="t('probePage.rotateWarning')"
      />
      <strong>{{ credential.name }}</strong>
      <dl>
        <div v-if="credential.probeId">
          <dt>{{ t('probePage.id') }}</dt>
          <dd>{{ credential.probeId }}</dd>
        </div>
        <div v-if="credential.apiUrl">
          <dt>{{ t('probePage.apiUrl') }}</dt>
          <dd>{{ credential.apiUrl }}</dd>
        </div>
        <div v-if="credential.expiresAt">
          <dt>{{ t('probePage.expiresAt') }}</dt>
          <dd>{{ formatDateTime(credential.expiresAt) }}</dd>
        </div>
      </dl>
      <t-alert
        v-if="expired"
        theme="error"
        :message="t('probePage.expired')"
      />
      <div
        v-else
        class="probe-credential__value"
      >
        <code>{{ credential.value }}</code>
        <t-tooltip :content="t('probePage.copy')"
          ><t-button
            shape="square"
            variant="outline"
            :aria-label="t('probePage.copy')"
            @click="copy"
            ><AppIcon :icon="Copy01Icon" /></t-button
        ></t-tooltip>
      </div>
    </div>

    <template #footer>
      <t-button
        theme="primary"
        @click="visible = false"
        >{{ t('common.close') }}</t-button
      >
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.probe-credential {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  strong,
  dd {
    overflow-wrap: anywhere;
  }
  dl {
    margin: 0;
    display: grid;
    gap: 8px;
  }
  dl > div {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 12px;
  }
  dt {
    color: @beacon-text-secondary;
  }
  dd {
    margin: 0;
  }
  &__value {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  code {
    flex: 1;
    min-width: 0;
    padding: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }
}
</style>
