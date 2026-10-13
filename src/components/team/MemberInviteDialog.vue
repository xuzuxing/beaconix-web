<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { sendInvitation, listProjects } from '@/api'
import type { Invitation, InvitableRole, Membership, Project } from '@/api/types'
import type { ProjectGrant } from '@/api/types/permissions'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { permissionEpoch } from '@/utils/access-context'
import ProjectGrantSelector from './ProjectGrantSelector.vue'
import { INVITABLE_ROLES } from '@/utils/team-presenter'

/**
 * 邀请成员：向邮箱发送邀请，可选角色（ADMIN / MEMBER / VIEWER）。
 * 已在团队内或已有待处理邀请的邮箱直接拦下，避免后端 409。
 */
defineOptions({ name: 'MemberInviteDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  orgId: string
  members: Membership[]
  invitations: Invitation[]
}>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()

const form = reactive({ email: '', role: 'MEMBER' as InvitableRole })
const submitting = ref(false)
const error = ref('')
const projects = ref<Project[]>([])
const grants = ref<ProjectGrant[]>([])
const loadingProjects = ref(false)
const adminConfirmed = ref(false)
const permissions = usePermissionsStore()
const allowed = computed(() => permissions.canOrganization(props.orgId, 'inviteMembers'))
let generation = 0

const roleOptions = computed(() =>
  INVITABLE_ROLES.filter(
    (role) =>
      role !== 'ADMIN' || permissions.canOrganization(props.orgId, 'grantOrganizationAdmin'),
  ).map((role) => ({ label: t(`workspace.member.roleOption.${role}`), value: role })),
)

/** 已占用邮箱：现役成员 + 待处理邀请 */
const takenEmails = computed(() => {
  const list = props.members
    .map((member) => member.user?.email ?? '')
    .concat(props.invitations.filter((item) => item.status === 'PENDING').map((item) => item.email))
  return new Set(list.filter(Boolean).map((email) => email.trim().toLowerCase()))
})

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    if (!value) return
    form.email = ''
    form.role = 'MEMBER'
    grants.value = []
    projects.value = []
    adminConfirmed.value = false
    void loadProjects()
  },
  { flush: 'sync' },
)
async function loadProjects() {
  if (!allowed.value || !visible.value) return
  const token = generation
  loadingProjects.value = true
  try {
    await permissions.ensureOrganization(props.orgId, true)
    if (token !== generation || !visible.value || !allowed.value) return
    const result = await listProjects(props.orgId)
    if (token === generation)
      projects.value = result.filter((project) => project.status === 'ACTIVE')
  } catch {
    if (token === generation) error.value = t('access.loadFailed')
  } finally {
    if (token === generation) loadingProjects.value = false
  }
}
watch(
  permissionEpoch,
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)
watch(
  () => form.role,
  (role, previous) => {
    adminConfirmed.value = false
    if (role === 'ADMIN' || previous === 'ADMIN') grants.value = []
    if (role === 'VIEWER')
      grants.value = grants.value.map((grant) => ({ ...grant, role: 'VIEWER' }))
  },
)

// 切换团队时关闭弹窗，避免把邀请发到上一个团队
watch(
  () => props.orgId,
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

function validate(): string {
  if (!allowed.value) return t('access.noPermission')
  if (loadingProjects.value) return t('common.loading')
  if (form.role === 'ADMIN') {
    if (
      !permissions.canOrganization(props.orgId, 'grantOrganizationAdmin') ||
      !adminConfirmed.value
    )
      return t('access.adminConfirm')
  } else if (
    !grants.value.length ||
    grants.value.length > 100 ||
    new Set(grants.value.map((grant) => grant.projectId)).size !== grants.value.length ||
    grants.value.some((grant) => !projects.value.some((project) => project.id === grant.projectId))
  ) {
    return t('access.selectRequired')
  }
  const email = form.email.trim()
  if (!email) return t('workspace.member.inviteRequired')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('workspace.member.inviteInvalidEmail')
  if (takenEmails.value.has(email.toLowerCase())) return t('workspace.member.inviteDuplicate')
  return ''
}

async function submit() {
  if (submitting.value) return
  const message = validate()
  if (message) {
    error.value = message
    return
  }

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    await permissions.ensureOrganization(props.orgId, true)
    if (token !== generation || !visible.value || !allowed.value) return
    const latestError = validate()
    if (latestError) {
      error.value = latestError
      return
    }
    await sendInvitation(props.orgId, {
      email: form.email.trim(),
      role: form.role,
      ...(form.role === 'ADMIN' ? {} : { projects: grants.value }),
    })
    if (token !== generation) return
    MessagePlugin.success(t('workspace.invitation.sent'))
    visible.value = false
    emit('saved')
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('workspace.member.inviteFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.member.inviteTitle')"
    width="min(640px, calc(100vw - 32px))"
    :confirm-btn="{
      content: t('workspace.member.inviteSend'),
      loading: submitting,
      disabled: !allowed || loadingProjects,
    }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="error" theme="error" :message="error" class="invite__error" />

    <t-form label-align="top" :colon="false" :data="form">
      <t-form-item :label="t('workspace.member.inviteEmail')">
        <t-input
          v-model="form.email"
          :maxlength="200"
          :placeholder="t('workspace.member.inviteEmailPlaceholder')"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.member.inviteRole')">
        <t-select v-model="form.role" :options="roleOptions" />
      </t-form-item>
      <t-checkbox v-if="form.role === 'ADMIN'" v-model="adminConfirmed">{{
        t('access.adminConfirm')
      }}</t-checkbox>
      <t-form-item v-else :label="t('access.projects')">
        <t-loading v-if="loadingProjects" />
        <ProjectGrantSelector
          v-else
          v-model="grants"
          :projects="projects"
          :viewer="form.role === 'VIEWER'"
          :disabled="submitting || !allowed"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.invite {
  &__error {
    margin-bottom: 16px;
  }
}
</style>
