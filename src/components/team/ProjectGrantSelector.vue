<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Project } from '@/api/types'
import type { ProjectGrant, ProjectRole } from '@/api/types/permissions'
const grants = defineModel<ProjectGrant[]>({ required: true })
const props = defineProps<{
  projects: Project[]
  viewer?: boolean
  disabled?: boolean
  effectiveRoles?: Record<string, ProjectRole>
}>()
const { t } = useI18n()
const search = ref('')
const candidates = computed(() =>
  props.projects.filter((project) =>
    `${project.name} ${project.key}`
      .toLowerCase()
      .includes(search.value.trim().toLowerCase()),
  ),
)
const roles = computed(() =>
  (props.viewer ? ['VIEWER'] : ['VIEWER', 'MEMBER', 'ADMIN']).map((role) => ({
    value: role,
    label: t(`access.role.${role}`),
  })),
)
function selected(id: string) {
  return grants.value.find((grant) => grant.projectId === id)
}
function toggle(id: string, checked: unknown) {
  if (props.disabled || !props.projects.some((project) => project.id === id))
    return
  if (
    checked &&
    (selected(id) ||
      !props.projects.some(
        (project) => project.id === id && project.status === 'ACTIVE',
      ))
  )
    return
  grants.value = checked
    ? [...grants.value, { projectId: id, role: 'VIEWER' }]
    : grants.value.filter((grant) => grant.projectId !== id)
}
function setRole(id: string, role: unknown) {
  if (props.disabled || !['VIEWER', 'MEMBER', 'ADMIN'].includes(String(role)))
    return
  grants.value = grants.value.map((grant) =>
    grant.projectId === id
      ? {
          ...grant,
          role: props.viewer ? 'VIEWER' : (String(role) as ProjectRole),
        }
      : grant,
  )
}
</script>
<template>
  <div class="grant-selector">
    <t-input
      v-model="search"
      clearable
      :placeholder="t('access.search')"
      :aria-label="t('access.search')"
    />
    <p>{{ t('access.selected', { count: grants.length }) }}</p>
    <div class="grant-selector__rows">
      <div
        v-for="project in candidates"
        :key="project.id"
        class="grant-selector__row"
      >
        <t-checkbox
          :checked="!!selected(project.id)"
          :disabled="
            disabled || (project.status !== 'ACTIVE' && !selected(project.id))
          "
          @change="(value: unknown) => toggle(project.id, value)"
        >
          <span class="grant-selector__name">{{ project.name }}</span>
          <small>{{ project.key }}</small>
          <small v-if="effectiveRoles?.[project.id]">{{
            t('access.effectiveRole', {
              role: t(`access.role.${effectiveRoles[project.id]}`),
            })
          }}</small>
        </t-checkbox>
        <t-tag
          v-if="project.status !== 'ACTIVE'"
          size="small"
          >{{ t('access.archived') }}</t-tag
        >
        <t-select
          v-if="selected(project.id)"
          :value="selected(project.id)?.role"
          :options="roles"
          :disabled="disabled || viewer || project.status !== 'ACTIVE'"
          :aria-label="`${project.name} ${t('access.projectPermissions')}`"
          @change="(role: unknown) => setRole(project.id, role)"
        />
      </div>
    </div>
  </div>
</template>
<style scoped lang="less">
.grant-selector {
  min-width: 0;
}
.grant-selector p {
  margin: 10px 0;
  color: @beacon-text-secondary;
}
.grant-selector__rows {
  max-height: 340px;
  overflow: auto;
}
.grant-selector__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid @beacon-border;
}
.grant-selector__row :deep(.t-checkbox) {
  flex: 1;
  min-width: 0;
}
.grant-selector__row :deep(.t-checkbox__label) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  overflow-wrap: anywhere;
  min-width: 0;
  white-space: normal;
}
.grant-selector__name {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.grant-selector__row :deep(.t-select__wrap) {
  width: 150px;
  flex: none;
}
.grant-selector__row small {
  color: @beacon-text-secondary;
}
@media (max-width: 480px) {
  .grant-selector__row {
    flex-wrap: wrap;
  }
  .grant-selector__row :deep(.t-select__wrap) {
    width: 100%;
  }
  .grant-selector__row :deep(.t-select .t-input) {
    min-height: 44px;
  }
  .grant-selector__row :deep(.t-checkbox) {
    min-height: 44px;
  }
}
</style>
