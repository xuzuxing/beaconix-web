<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { getMonitor } from '@/api'
import type { Monitor } from '@/api/types'
import HeaderActions from '@/components/HeaderActions.vue'
import MonitorEditorForm from '@/components/monitor/MonitorEditorForm.vue'
import { usePageHeader } from '@/composables/usePageHeader'
import { useProjectAccess } from '@/composables/useProjectAccess'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  sessionEpoch,
} from '@/utils/access-context'

/**
 * 监控项单页编辑：字段多，整页承载比弹窗好用。
 * 路由 `/monitor/:projectId/new`（新建）与 `/monitor/:projectId/:monitorId/edit`（编辑），
 * 表单本身在 `MonitorEditorForm` 里，本页只负责加载数据、顶栏操作与保存后的跳转。
 */
defineOptions({ name: 'MonitorEditorView' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const permissions = usePermissionsStore()
const projectId = computed(() => String(route.params.projectId ?? ''))
const monitorId = computed(() => String(route.params.monitorId ?? ''))
const editing = computed(() => Boolean(monitorId.value))
const { canManage } = useProjectAccess(projectId)

const formRef = ref<InstanceType<typeof MonitorEditorForm>>()
const monitor = ref<Monitor>()
const loading = ref(false)
const loadError = ref('')
let generation = 0

/** 返回列表保留筛选条件；编辑态优先回到该监控详情 */
const listBack = computed(() => ({ name: 'monitor', query: route.query }))
usePageHeader({
  title: () =>
    t(editing.value ? 'workspace.monitor.edit' : 'workspace.monitor.create'),
  back: listBack,
})

async function load() {
  const token = ++generation
  loadError.value = ''
  monitor.value = undefined
  if (!editing.value) return
  const project = projectId.value
  const id = monitorId.value
  if (!project || !id) return
  const context = accessContext()
  loading.value = true
  try {
    await permissions.ensureProject(project)
    const result = await getMonitor(project, id)
    if (token !== generation || !isCurrentContext(context)) return
    monitor.value = result
  } catch (cause) {
    if (token !== generation) return
    loadError.value =
      cause instanceof Error ? cause.message : t('monitorPage.loadFailed')
  } finally {
    if (token === generation) loading.value = false
  }
}

watch(
  [projectId, monitorId, sessionEpoch],
  () => {
    void load()
  },
  { immediate: true, flush: 'sync' },
)

// 表单内部的 submitting / error 通过 defineExpose 暴露，顶栏按钮直接用
const submitting = computed(() => formRef.value?.submitting ?? false)

function submit() {
  void formRef.value?.submit()
}

/** 保存成功统一进详情页：新建的监控也能立刻看到首次检查结果 */
function onSaved(savedProjectId: string, savedMonitorId: string) {
  void router.push({
    name: 'monitor-detail',
    params: { projectId: savedProjectId, monitorId: savedMonitorId },
    query: route.query,
  })
}

function cancel() {
  if (editing.value) {
    void router.push({
      name: 'monitor-detail',
      params: { projectId: projectId.value, monitorId: monitorId.value },
      query: route.query,
    })
    return
  }
  void router.push(listBack.value)
}

onScopeDispose(() => {
  generation++
})
</script>

<template>
  <section class="monitor-editor">
    <HeaderActions>
      <t-button
        variant="outline"
        :disabled="submitting"
        @click="cancel"
        >{{ t('common.cancel') }}</t-button
      >
      <t-button
        theme="primary"
        :loading="submitting"
        :disabled="!canManage || loading || Boolean(loadError)"
        @click="submit"
        >{{ t('common.confirm') }}</t-button
      >
    </HeaderActions>
    <t-alert
      v-if="loadError"
      theme="error"
      :message="loadError"
    />
    <t-alert
      v-else-if="!canManage"
      theme="warning"
      :message="t('access.unavailable')"
    />
    <t-loading
      v-else-if="loading"
      size="large"
      :text="t('common.loading')"
    />
    <MonitorEditorForm
      v-else
      ref="formRef"
      :project-id="projectId"
      :monitor="monitor"
      @saved="onSaved"
    />
  </section>
</template>

<style scoped lang="less">
.monitor-editor {
  min-width: 0;
  padding-bottom: 24px;
}
</style>
