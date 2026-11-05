<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
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
const columns = [
  { colKey: 'release', title: t('rum.release'), width: 140 },
  { colKey: 'artifactPath', title: t('rum.artifactPath'), ellipsis: true },
  { colKey: 'checksum', title: t('rum.checksum'), width: 150 },
  { colKey: 'sizeBytes', title: t('rum.size'), width: 110 },
  { colKey: 'uploadedById', title: t('rum.uploadedBy'), width: 150 },
  { colKey: 'createdAt', title: t('rum.created'), width: 190 },
  { colKey: 'action', title: '', width: 90 },
]
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
/** 覆盖/删除都不可回滚，统一走 TDesign 确认弹窗 */
function confirmAction(header: string, body: string, onConfirm: () => void) {
  const dialog = DialogPlugin.confirm({
    header,
    body,
    theme: 'warning',
    confirmBtn: t('common.confirm'),
    cancelBtn: t('common.cancel'),
    onConfirm: () => {
      dialog.destroy()
      onConfirm()
    },
    onCancel: () => dialog.destroy(),
    onClose: () => dialog.destroy(),
  })
}
async function applyUpload(f: File, r: string, path: string) {
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
function uploadMap() {
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
  const replacing = resource.data.value?.some(
    (x) => x.release === r && x.artifactPath === normalized,
  )
  if (replacing) {
    confirmAction(t('rum.upload'), t('rum.mapReplace'), () => {
      void applyUpload(f, r, path)
    })
    return
  }
  void applyUpload(f, r, path)
}
async function applyRemove(id: string) {
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
function remove(id: string) {
  if (submitting.value) return
  confirmAction(t('rum.remove'), t('rum.mapDelete'), () => {
    void applyRemove(id)
  })
}
</script>
<template>
  <t-card class="rum-maps">
    <template #title>{{ t('rum.maps') }}</template>
    <p class="rum-maps__hint">{{ t('rum.mapHint') }}</p>
    <form
      v-if="canManage"
      class="upload rum-filter"
      @submit.prevent="uploadMap"
    >
      <t-input
        v-model="release"
        class="rum-filter__field"
        maxlength="100"
        :placeholder="t('rum.release')"
      /><t-input
        v-model="artifactPath"
        class="rum-filter__field"
        maxlength="2048"
        :placeholder="t('rum.artifactPath')"
      /><input
        class="rum-filter__field rum-maps__file"
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
    >
      <t-table
        row-key="id"
        :data="resource.data.value ?? []"
        :columns="columns"
        :empty="t('rum.empty')"
        hover
      >
        <template #artifactPath="{ row }"
          ><code class="rum-maps__path">{{ row.artifactPath }}</code></template
        >
        <template #checksum="{ row }"
          ><span class="rum-maps__muted"
            >{{ row.checksum.slice(0, 12) }}…</span
          ></template
        >
        <template #sizeBytes="{ row }"
          ><span class="rum-maps__muted">{{ row.sizeBytes }} B</span></template
        >
        <template #uploadedById="{ row }"
          ><span class="rum-maps__muted">{{
            row.uploadedById || '—'
          }}</span></template
        >
        <template #action="{ row }"
          ><t-link
            v-if="canManage"
            theme="danger"
            :disabled="submitting"
            @click="remove(row.id)"
            >{{ t('rum.remove') }}</t-link
          ></template
        >
      </t-table>
    </RumState>
  </t-card>
</template>
<style scoped lang="less">
.rum-maps {
  min-width: 0;

  &__hint {
    margin: 0 0 @beacon-gap-l;
    color: @beacon-text-secondary;
  }

  &__file {
    padding-top: 6px;
  }

  &__path {
    overflow-wrap: anywhere;
  }

  &__muted {
    color: @beacon-text-secondary;
  }
}
</style>
