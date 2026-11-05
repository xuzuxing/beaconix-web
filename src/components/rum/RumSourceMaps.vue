<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { onScopeDispose, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import {
  deleteRumSourceMap,
  listRumSourceMaps,
  uploadRumSourceMap,
} from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import { accessContext, isCurrentContext } from '@/utils/access-context'
import RumState from './RumState.vue'
const { t } = useI18n()
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const { projectId: p, appId: a, canManage, authorizeWrite } = useRumContext()
const file = ref<File | null>(null)
const release = ref('')
const artifactPath = ref('')
const submitting = ref(false)
watch(
  [p, a],
  () => {
    file.value = null
    release.value = ''
    artifactPath.value = ''
  },
  { flush: 'sync' },
)
onScopeDispose(() => {
  file.value = null
  release.value = ''
  artifactPath.value = ''
})
const resource = useRumResource(
  (signal) => listRumSourceMaps(p.value, a.value, { signal }),
  [p, a],
)
function choose(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}
async function uploadMap() {
  if (submitting.value) return
  const f = file.value
  const r = release.value.trim()
  const path = artifactPath.value.trim()
  if (
    !f ||
    f.size > 5 * 1024 * 1024 ||
    !/\.(map|json)$/i.test(f.name) ||
    !r ||
    r.length > 100 ||
    !path ||
    path.length > 2048 ||
    !/\.m?js(?:[?#].*)?$/i.test(path)
  ) {
    void MessagePlugin.error(t('rum.invalid'))
    return
  }
  const normalized = (() => {
    try {
      return new URL(path).pathname
    } catch {
      return path.split(/[?#]/)[0]?.replace(/^([^/])/, '/$1') ?? ''
    }
  })()
  if (
    resource.data.value?.some(
      (x) => x.release === r && x.artifactPath === normalized,
    ) &&
    !window.confirm(t('rum.mapReplace'))
  )
    return
  const ctx = accessContext()
  const project = p.value
  const app = a.value
  submitting.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    const data = new FormData()
    data.append('file', f)
    data.append('release', r)
    data.append('artifactPath', path)
    const result = await uploadRumSourceMap(project, app, data)
    if (isCurrentContext(ctx)) {
      void MessagePlugin.success(
        t('rum.uploaded', { count: result.reprocessed }),
      )
      file.value = null
      release.value = ''
      artifactPath.value = ''
      await resource.reload()
    }
  } catch {
    if (isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
async function remove(id: string) {
  if (submitting.value || !window.confirm(t('rum.mapDelete'))) return
  const ctx = accessContext()
  const project = p.value
  const app = a.value
  submitting.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await deleteRumSourceMap(project, app, id)
    if (isCurrentContext(ctx)) await resource.reload()
  } catch {
    if (isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <t-card>
    <p>{{ t('rum.mapHint') }}</p>
    <form
      v-if="canManage"
      class="upload rum-filter"
      @submit.prevent="uploadMap"
    >
      <t-input
        class="rum-filter__field"
        v-model="release"
        maxlength="100"
        :placeholder="t('rum.release')"
      /><t-input
        class="rum-filter__field"
        v-model="artifactPath"
        maxlength="2048"
        :placeholder="t('rum.artifactPath')"
      /><input
        class="rum-filter__field"
        type="file"
        accept=".map,.json,application/json"
        @change="choose"
      /><t-button
        type="submit"
        :loading="submitting"
        >{{ t('rum.upload') }}</t-button
      >
    </form>
    <RumState
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
      ><t-empty
        v-if="!resource.data.value?.length"
        :description="t('rum.empty')"
      />
      <article
        v-for="item in resource.data.value"
        :key="item.id"
        class="source-map-item"
      >
        <strong>{{ item.release }}</strong
        ><code>{{ item.artifactPath }}</code
        ><span
          >{{ t('rum.checksum') }}: {{ item.checksum.slice(0, 12) }} ·
          {{ item.sizeBytes }} B</span
        ><span
          >{{ t('rum.uploadedBy') }}: {{ item.uploadedById || '—' }} ·
          {{ t('rum.created') }}: {{ item.createdAt }} ? {{ t('rum.updated') }}:
          {{ item.updatedAt }}</span
        ><t-button
          v-if="canManage"
          variant="text"
          :disabled="submitting"
          @click="remove(item.id)"
          >{{ t('rum.remove') }}</t-button
        >
      </article></RumState
    >
  </t-card>
</template>
<style scoped>
.source-map-item {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}
.source-map-item code {
  overflow-wrap: anywhere;
}
.source-map-item span {
  color: var(--td-text-color-secondary);
}
</style>
