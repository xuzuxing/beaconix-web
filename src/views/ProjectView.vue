<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { archiveProject, createProject, deleteProject, restoreProject, updateProject } from '@/api'
import type { Project } from '@/api/types'
import { useOrganizationStore } from '@/stores'

/** 项目：当前团队下的项目 CRUD / 归档 / 删除与恢复 */
defineOptions({ name: 'ProjectView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()

const submitting = ref(false)

/** 本次会话内软删除的项目：列表接口不返回已删除项，这里提供恢复入口 */
const deleted = ref<Project[]>([])

const orgId = computed(() => orgStore.currentOrganizationId)
const projects = computed(() => orgStore.projects)

onMounted(async () => {
  if (!orgId.value) {
    await orgStore.loadOrganizations().catch(() => undefined)
  }
  if (!projects.value.length) {
    await orgStore.loadProjects().catch(() => undefined)
  }
})

async function refresh() {
  await orgStore.loadProjects().catch(() => undefined)
}

// ---------- 新建 / 编辑 ----------
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref('')
const form = reactive({ name: '', key: '', description: '' })

function openCreate() {
  dialogMode.value = 'create'
  editingId.value = ''
  form.name = ''
  form.key = ''
  form.description = ''
  dialogVisible.value = true
}

function openEdit(project: Project) {
  dialogMode.value = 'edit'
  editingId.value = project.id
  form.name = project.name
  form.key = project.key
  form.description = project.description ?? ''
  dialogVisible.value = true
}

async function submitDialog() {
  if (!form.name.trim()) {
    MessagePlugin.warning(t('workspace.project.nameRequired'))
    return
  }
  if (dialogMode.value === 'create' && !form.key.trim()) {
    MessagePlugin.warning(t('workspace.project.keyRequired'))
    return
  }

  submitting.value = true
  try {
    const description = form.description.trim() || undefined

    if (dialogMode.value === 'create') {
      const created = await createProject(orgId.value, {
        name: form.name.trim(),
        key: form.key.trim().toUpperCase(),
        description,
      })
      await refresh()
      orgStore.switchProject(created.id)
      MessagePlugin.success(t('workspace.project.created'))
    } else {
      await updateProject(orgId.value, editingId.value, { name: form.name.trim(), description })
      await refresh()
      MessagePlugin.success(t('workspace.project.updated'))
    }
    dialogVisible.value = false
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}

// ---------- 归档 / 删除 / 恢复 ----------
async function archive(project: Project) {
  try {
    await archiveProject(orgId.value, project.id)
    await refresh()
    MessagePlugin.success(t('workspace.project.archivedDone'))
  } catch {
    // 请求层已统一提示
  }
}

async function remove(project: Project) {
  try {
    await deleteProject(orgId.value, project.id)
    deleted.value = [project, ...deleted.value.filter((item) => item.id !== project.id)]
    await refresh()
    MessagePlugin.success(t('workspace.project.deleted'))
  } catch {
    // 请求层已统一提示
  }
}

async function restore(project: Project) {
  try {
    await restoreProject(orgId.value, project.id)
    deleted.value = deleted.value.filter((item) => item.id !== project.id)
    await refresh()
    MessagePlugin.success(t('workspace.project.restored'))
  } catch {
    // 请求层已统一提示
  }
}
</script>

<template>
  <div class="project">
    <div class="project__bar">
      <span class="project__hint">
        {{ orgStore.currentOrganization?.name ?? '—' }} · {{ t('workspace.project.subtitle') }}
      </span>
      <t-button theme="primary" size="small" @click="openCreate">
        {{ t('workspace.project.create') }}
      </t-button>
    </div>

    <div v-if="projects.length" class="project__grid">
      <div v-for="project in projects" :key="project.id" class="project__card"
        :class="{ 'is-active': project.id === orgStore.currentProjectId }">
        <div class="project__head">
          <span class="project__name">{{ project.name }}</span>
          <span class="project__key">{{ project.key }}</span>
        </div>

        <p class="project__desc-text">{{ project.description || '—' }}</p>

        <div class="project__foot">
          <span class="project__status">
            {{
              project.status === 'ACTIVE'
                ? t('workspace.project.active')
                : t('workspace.project.archived')
            }}
          </span>

          <span class="project__actions">
            <t-button variant="text" size="small" @click="openEdit(project)">
              {{ t('workspace.project.edit') }}
            </t-button>

            <t-popconfirm
              v-if="project.status === 'ACTIVE'"
              :content="t('workspace.project.archiveConfirm')"
              @confirm="archive(project)"
            >
              <t-button variant="text" size="small">{{ t('workspace.project.archive') }}</t-button>
            </t-popconfirm>

            <t-popconfirm :content="t('workspace.project.deleteConfirm')" @confirm="remove(project)">
              <t-button variant="text" size="small" theme="danger">
                {{ t('workspace.project.delete') }}
              </t-button>
            </t-popconfirm>
          </span>
        </div>
      </div>
    </div>

    <p v-else class="project__empty">{{ t('workspace.project.empty') }}</p>

    <!-- 本次会话内被删除的项目：提供恢复入口 -->
    <template v-if="deleted.length">
      <h3 class="project__section">{{ t('workspace.project.recentlyDeleted') }}</h3>
      <div class="project__grid">
        <div v-for="project in deleted" :key="project.id" class="project__card is-deleted">
          <div class="project__head">
            <span class="project__name">{{ project.name }}</span>
            <span class="project__key">{{ project.key }}</span>
          </div>
          <div class="project__foot">
            <span class="project__status">{{ t('workspace.project.archived') }}</span>
            <t-button variant="text" size="small" @click="restore(project)">
              {{ t('workspace.project.restore') }}
            </t-button>
          </div>
        </div>
      </div>
    </template>

    <t-dialog
      v-model:visible="dialogVisible"
      :header="dialogMode === 'create' ? t('workspace.project.create') : t('workspace.project.edit')"
      :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
      :cancel-btn="t('common.cancel')"
      width="480px"
      @confirm="submitDialog"
    >
      <t-form :data="form" label-align="top" :colon="false">
        <t-form-item :label="t('workspace.project.name')">
          <t-input v-model="form.name" :placeholder="t('workspace.project.namePlaceholder')" />
        </t-form-item>
        <t-form-item :label="t('workspace.project.key')">
          <t-input
            v-model="form.key"
            :disabled="dialogMode === 'edit'"
            :placeholder="t('workspace.project.keyPlaceholder')"
          />
        </t-form-item>
        <t-form-item :label="t('workspace.team.description')">
          <t-textarea v-model="form.description" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped lang="less">
.project {
  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  &__hint {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__section {
    margin: 24px 0 12px;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;

    &.is-active {
      border-color: @beacon-brand;
    }

    &.is-deleted {
      opacity: 0.7;
    }
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__key {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__desc-text {
    display: -webkit-box;
    min-height: 40px;
    margin: 0;
    overflow: hidden;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid @beacon-border;
  }

  &__status {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__actions {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }

  &__empty {
    margin: 0;
    padding: 48px 0;
    color: @beacon-text-tertiary;
    text-align: center;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }
}
</style>
