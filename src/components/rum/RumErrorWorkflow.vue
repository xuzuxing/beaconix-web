<script setup lang="ts">
import { onScopeDispose, shallowRef, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { updateRumError } from '@/api/modules/rum'
import type { RumErrorGroup, RumErrorStatus } from '@/api/types/rum'
import { useRumContext } from '@/composables/useRumContext'
import { accessContext, isCurrentContext } from '@/utils/access-context'

const props = defineProps<{ error: RumErrorGroup }>()
const emit = defineEmits<{ updated: [] }>()
const { t } = useI18n()
const { projectId, appId } = useRumContext()
const status = shallowRef<RumErrorStatus>(props.error.status)
const ignoredUntil = shallowRef(props.error.ignoredUntil ?? '')
const submitting = shallowRef(false)
let disposed = false

onScopeDispose(() => {
  disposed = true
})

watch(
  () => props.error,
  (error) => {
    status.value = error.status
    ignoredUntil.value = error.ignoredUntil ?? ''
  },
)

async function save() {
  if (submitting.value) return
  const ctx = accessContext()
  submitting.value = true
  try {
    await updateRumError(projectId.value, appId.value, props.error.id, {
      status: status.value,
      ignoredUntil:
        status.value === 'IGNORED' && ignoredUntil.value
          ? new Date(ignoredUntil.value).toISOString()
          : null,
    })
    if (!disposed && isCurrentContext(ctx)) {
      void MessagePlugin.success(t('rum.errorWorkflowSaved'))
      emit('updated')
    }
  } catch {
    if (!disposed && isCurrentContext(ctx))
      void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <t-card class="error-workflow">
    <template #title>{{ t('rum.errorWorkflow') }}</template>
    <template #actions>
      <t-tag
        :theme="
          error.status === 'RESOLVED'
            ? 'success'
            : error.status === 'IGNORED'
              ? 'warning'
              : 'danger'
        "
      >
        {{ t(`rum.errorStatus.${error.status}`) }}
      </t-tag>
    </template>
    <p class="error-workflow__hint">{{ t('rum.errorWorkflowHint') }}</p>
    <div class="error-workflow__form">
      <label>
        {{ t('rum.status') }}
        <t-select
          v-model="status"
          :options="[
            { value: 'UNRESOLVED', label: t('rum.errorStatus.UNRESOLVED') },
            { value: 'RESOLVED', label: t('rum.errorStatus.RESOLVED') },
            { value: 'IGNORED', label: t('rum.errorStatus.IGNORED') },
          ]"
        />
      </label>
      <label v-if="status === 'IGNORED'">
        {{ t('rum.ignoredUntil') }}
        <t-date-picker
          v-model="ignoredUntil"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable
        />
        <small>{{ t('rum.ignoredUntilHint') }}</small>
      </label>
      <t-button
        :loading="submitting"
        @click="save"
      >
        {{ t('rum.save') }}
      </t-button>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.error-workflow {
  margin-bottom: 16px;
  min-width: 0;

  &__hint {
    margin: 0 0 14px;
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__form {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(240px, 1fr) auto;
    gap: 12px;
    align-items: end;

    label {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    small {
      color: @beacon-text-tertiary;
      font-size: 11px;
    }

    .t-button {
      justify-self: start;
    }
  }
}

@media (max-width: 760px) {
  .error-workflow__form {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
