<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  getMemberProjectPermissions,
  replaceMemberProjectPermissions,
  listProjects,
} from '@/api'
import type { Project } from '@/api/types'
import type {
  MemberProjectPermissions,
  ProjectGrant,
} from '@/api/types/permissions'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { permissionEpoch } from '@/utils/access-context'
import { ApiError } from '@/utils/request'
import ProjectGrantSelector from './ProjectGrantSelector.vue'
import AppIcon from '@/components/AppIcon.vue'
import { Cancel01Icon } from '@/icons'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ orgId: string; userId: string }>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const permissions = usePermissionsStore()
const snapshot = ref<MemberProjectPermissions | null>(null)
const projects = ref<Project[]>([])
const grants = ref<ProjectGrant[]>([])
const previousDraft = ref<ProjectGrant[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const conflict = ref('')
const blocked = ref(false)
let generation = 0
const allowed = computed(() =>
  permissions.canOrganization(props.orgId, 'manageProjectPermissions'),
)
const inherited = computed(() => snapshot.value?.accessMode === 'ALL_PROJECTS')
const inactive = computed(() =>
  grants.value.some(
    (grant) =>
      !projects.value.some(
        (project) =>
          project.id === grant.projectId && project.status === 'ACTIVE',
      ),
  ),
)
const selectorProjects = computed(() => [
  ...projects.value,
  ...(snapshot.value?.projects ?? [])
    .filter(
      (grant) =>
        !projects.value.some((project) => project.id === grant.projectId),
    )
    .map((grant) => ({
      id: grant.projectId,
      name: grant.projectName,
      key: '',
      status: 'ARCHIVED' as const,
      organizationId: props.orgId,
      description: null,
      createdById: null,
      createdAt: '',
      updatedAt: '',
    })),
])
const diff = computed(() => {
  const before = snapshot.value?.projects ?? []
  return {
    added: grants.value.filter(
      (grant) => !before.some((item) => item.projectId === grant.projectId),
    ).length,
    removed: before.filter(
      (grant) =>
        !grants.value.some((item) => item.projectId === grant.projectId),
    ).length,
    changed: grants.value.filter((grant) =>
      before.some(
        (item) =>
          item.projectId === grant.projectId &&
          item.assignedRole !== grant.role,
      ),
    ).length,
  }
})
function draftOf(value: MemberProjectPermissions) {
  return value.projects.map((grant) => ({
    projectId: grant.projectId,
    role:
      value.organizationRole === 'VIEWER'
        ? ('VIEWER' as const)
        : grant.assignedRole,
  }))
}
async function load() {
  if (!visible.value || !allowed.value) return
  const token = ++generation
  loading.value = true
  error.value = ''
  snapshot.value = null
  try {
    const [current, candidates] = await Promise.all([
      getMemberProjectPermissions(props.orgId, props.userId),
      listProjects(props.orgId),
    ])
    if (token !== generation) return
    snapshot.value = current
    projects.value = candidates
    grants.value = draftOf(current)
  } catch (cause) {
    if (token === generation)
      error.value =
        cause instanceof Error ? cause.message : t('access.loadFailed')
  } finally {
    if (token === generation) loading.value = false
  }
}
async function save() {
  if (
    !snapshot.value ||
    !allowed.value ||
    inherited.value ||
    saving.value ||
    blocked.value ||
    inactive.value ||
    grants.value.length > 100
  )
    return
  const token = generation
  const current = snapshot.value
  saving.value = true
  error.value = ''
  try {
    await permissions.ensureOrganization(props.orgId, true)
    if (token !== generation || !visible.value || !allowed.value) return
    await replaceMemberProjectPermissions(props.orgId, props.userId, {
      expectedMembershipId: current.membershipId,
      expectedVersion: current.projectPermissionsVersion,
      projects: grants.value.map((grant) => ({ ...grant })),
    })
    if (token !== generation) return
    MessagePlugin.success(t('access.saved'))
    visible.value = false
    window.dispatchEvent(new Event('beacon-permissions-changed'))
    emit('saved')
  } catch (cause) {
    if (token !== generation) return
    if (cause instanceof ApiError && cause.status === 409) {
      previousDraft.value = grants.value.map((grant) => ({ ...grant }))
      blocked.value = true
      await load()
      const rejoined = snapshot.value?.membershipId !== current.membershipId
      conflict.value = t(rejoined ? 'access.rejoined' : 'access.conflict')
      if (rejoined) previousDraft.value = []
    } else if (cause instanceof ApiError && cause.status === 404) {
      visible.value = false
      emit('saved')
    } else {
      blocked.value = true
      error.value = t('access.unknownSave')
    }
  } finally {
    saving.value = false
  }
}
watch(
  visible,
  (open) => {
    generation++
    snapshot.value = null
    grants.value = []
    previousDraft.value = []
    conflict.value = ''
    blocked.value = false
    if (open) void load()
  },
  { flush: 'sync' },
)
watch(
  () => [props.orgId, props.userId, permissionEpoch.value],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)
async function editLatest() {
  await load()
  if (!snapshot.value) return
  blocked.value = false
  conflict.value = ''
  previousDraft.value = []
}
</script>
<template>
  <t-drawer
    v-model:visible="visible"
    :header="t('access.projectPermissions')"
    size="min(620px, 100vw)"
    :footer="false"
    :close-btn="true"
    :close-on-esc-keydown="true"
  >
    <template #close-btn>
      <t-button
        class="grant-close"
        variant="text"
        shape="square"
        :aria-label="t('common.close')"
        @click="visible = false"
      >
        <AppIcon :icon="Cancel01Icon" />
      </t-button>
    </template>
    <t-loading
      v-if="loading"
      :text="t('common.loading')"
    />
    <t-alert
      v-if="error"
      theme="error"
      :message="error"
    />
    <t-alert
      v-if="conflict"
      theme="warning"
      :message="conflict"
    />
    <template v-if="snapshot">
      <p v-if="inherited">{{ t('access.allProjects') }}</p>
      <template v-else>
        <t-alert
          v-if="inactive"
          theme="warning"
          :message="t('access.archivedHint')"
        />
        <t-alert
          v-if="snapshot.organizationRole === 'VIEWER'"
          theme="info"
          :message="t('access.viewerCap')"
        />
        <ProjectGrantSelector
          v-model="grants"
          :projects="selectorProjects"
          :viewer="snapshot.organizationRole === 'VIEWER'"
          :disabled="!allowed || saving || blocked"
          :effective-roles="
            Object.fromEntries(
              snapshot.projects.map((grant) => [
                grant.projectId,
                grant.effectiveRole,
              ]),
            )
          "
        />
        <p>{{ t('access.changes', diff) }}</p>
        <div
          v-if="previousDraft.length"
          class="grant-diff"
        >
          <strong>{{ t('access.draft') }}</strong>
          <p
            v-for="grant in previousDraft"
            :key="grant.projectId"
          >
            {{
              selectorProjects.find((project) => project.id === grant.projectId)
                ?.name ?? grant.projectId
            }}
            · {{ t(`access.role.${grant.role}`) }}
          </p>
          <strong>{{ t('access.latest') }}</strong>
        </div>
        <t-button
          v-if="blocked"
          class="grant-command"
          variant="outline"
          @click="editLatest"
          >{{ t('access.confirmLatest') }}</t-button
        >
        <t-popconfirm
          v-else-if="!grants.length && allowed"
          :content="t('access.revokeAll')"
          @confirm="save"
        >
          <t-button
            class="grant-command"
            theme="danger"
            :loading="saving"
            >{{ t('access.save') }}</t-button
          >
        </t-popconfirm>
        <t-button
          v-else
          class="grant-command"
          :disabled="!allowed || inactive || grants.length > 100"
          :loading="saving"
          @click="save"
          >{{ t('access.save') }}</t-button
        >
      </template>
    </template>
    <t-button
      v-else-if="!loading"
      class="grant-command"
      variant="outline"
      @click="load"
      >{{ t('access.retry') }}</t-button
    >
  </t-drawer>
</template>
<style scoped>
.grant-diff {
  padding: 12px 0;
  overflow-wrap: anywhere;
}
@media (max-width: 480px) {
  .grant-command,
  .grant-close {
    min-height: 44px;
  }
  .grant-close {
    min-width: 44px;
  }
}
</style>
