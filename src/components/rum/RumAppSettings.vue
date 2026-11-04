<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import { setRumAppEnabled, updateRumApp } from '@/api/modules/rum'
import type { RumApp } from '@/api/types/rum'
import { useRumContext } from '@/composables/useRumContext'
import { accessContext, isCurrentContext } from '@/utils/access-context'

const props = defineProps<{ app: RumApp }>()
const emit = defineEmits<{ updated: [] }>()
const { t } = useI18n()
const { projectId, appId, canManage, authorizeWrite } = useRumContext()
const name = ref(props.app.name)
const loading = ref(false)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
watch(
  () => props.app.name,
  (value) => {
    name.value = value
  },
)
async function save() {
  const value = name.value.trim()
  if (!value || value.length > 100 || loading.value) return
  const ctx = accessContext(),
    project = projectId.value,
    app = appId.value
  loading.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await updateRumApp(project, app, { name: value })
    if (isCurrentContext(ctx) && !disposed) emit('updated')
  } catch {
    if (isCurrentContext(ctx))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    loading.value = false
  }
}
async function toggle() {
  if (
    loading.value ||
    !window.confirm(
      t(
        props.app.enabled ? 'rumApps.disableConfirm' : 'rumApps.enableConfirm',
        { name: props.app.name },
      ),
    )
  )
    return
  const ctx = accessContext(),
    project = projectId.value,
    app = appId.value,
    enabled = !props.app.enabled
  loading.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await setRumAppEnabled(project, app, enabled)
    if (isCurrentContext(ctx) && !disposed) emit('updated')
  } catch {
    if (isCurrentContext(ctx))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <t-card
    :title="t('rumProject.settings')"
    :bordered="false"
  >
    <div class="settings">
      <label
        >{{ t('rumApps.name')
        }}<t-input
          v-model="name"
          maxlength="100"
          :disabled="!canManage"
      /></label>
      <t-button
        v-if="canManage"
        theme="primary"
        :loading="loading"
        :disabled="!name.trim()"
        @click="save"
        >{{ t('rumApps.save') }}</t-button
      >
      <div>
        {{ t('rumProject.status') }}：<t-tag
          :theme="app.enabled ? 'success' : 'default'"
          >{{ t(app.enabled ? 'rumApps.enabled' : 'rumApps.disabled') }}</t-tag
        >
      </div>
      <t-button
        v-if="canManage"
        variant="outline"
        :loading="loading"
        @click="toggle"
        >{{ t(app.enabled ? 'rumApps.disable' : 'rumApps.enable') }}</t-button
      >
    </div>
  </t-card>
</template>
<style scoped>
.settings {
  display: grid;
  gap: 16px;
  justify-items: start;
  max-width: 400px;
}
label {
  display: grid;
  gap: 8px;
  width: 100%;
}
</style>
