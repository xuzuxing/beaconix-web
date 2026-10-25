<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { ProbeValidationChallenge } from '@/api/types/admin'
import { formatDateTime } from '@/utils/billing'

/**
 * 系统探针联通校验结果：后端只创建挑战，真正的结果由探针在下一次心跳回报，
 * 因此这里展示挑战标识、有效期与后端给出的状态，而不是「校验通过 / 失败」。
 */
defineOptions({ name: 'SystemProbeValidateDialog' })

const visible = defineModel<boolean>('visible', { required: true })
defineProps<{
  challenge: ProbeValidationChallenge | null
  probeName?: string
}>()
const { t } = useI18n()
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('adminPage.probe.validateTitle')"
    width="min(520px, calc(100vw - 32px))"
  >
    <div
      v-if="challenge"
      class="probe-validate"
    >
      <t-alert
        theme="info"
        :message="t('adminPage.probe.validateDesc')"
      />

      <dl class="probe-validate__info">
        <div v-if="probeName">
          <dt>{{ t('adminPage.common.name') }}</dt>
          <dd>{{ probeName }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.probe.validateId') }}</dt>
          <dd class="probe-validate__mono">{{ challenge.validationId }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.probe.validateStatus') }}</dt>
          <dd>{{ challenge.status }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.probe.validateExpiresAt') }}</dt>
          <dd>{{ formatDateTime(challenge.expiresAt) }}</dd>
        </div>
      </dl>
    </div>

    <template #footer>
      <t-button
        theme="primary"
        @click="visible = false"
      >
        {{ t('adminPage.common.close') }}
      </t-button>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.probe-validate {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__info {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0;

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
    }

    dt {
      flex: none;
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 0;
      overflow: hidden;
      color: @beacon-text-primary;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__mono {
    font-family: monospace;
    font-size: @beacon-font-size-base;
  }
}
</style>
