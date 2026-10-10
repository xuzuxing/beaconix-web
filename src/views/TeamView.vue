<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  createOrganization,
  deleteOrganization,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
  sendInvitation,
  updateMemberRole,
  updateOrganization,
} from '@/api'
import type { InvitableRole, Invitation, Membership, MembershipRole, Organization } from '@/api/types'
import { useOrganizationStore, useUserStore } from '@/stores'

type TabValue = 'teams' | 'members' | 'invitations'

/** 团队：组织 CRUD + 成员管理 + 邀请 */
defineOptions({ name: 'TeamView' })

const { t } = useI18n()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

const activeTab = ref<TabValue>('teams')
const members = ref<Membership[]>([])
const invitations = ref<Invitation[]>([])
const loading = ref(false)

const ROLE_OPTIONS: MembershipRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
const INVITE_ROLE_OPTIONS: InvitableRole[] = ['ADMIN', 'MEMBER', 'VIEWER']

const currentOrgId = computed(() => orgStore.currentOrganizationId)

/** 当前用户是否可管理当前团队（OWNER / ADMIN，或平台超管） */
const canManage = computed(() => {
  if (userStore.isSuperAdmin) return true
  const mine = members.value.find((item) => item.userId === userStore.user?.id)
  return mine?.role === 'OWNER' || mine?.role === 'ADMIN'
})

/** 当前用户在当前团队里的角色 */
const myRole = computed(() => {
  const mine = members.value.find((item) => item.userId === userStore.user?.id)
  return mine?.role ?? ''
})

async function loadCurrentOrgData() {
  if (!currentOrgId.value) {
    members.value = []
    invitations.value = []
    return
  }

  loading.value = true
  try {
    members.value = await listMembers(currentOrgId.value)
    // 只有管理权限下才有必要拉邀请列表
    invitations.value = canManage.value ? await listInvitations(currentOrgId.value) : []
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!orgStore.organizations.length) {
    await orgStore.loadOrganizations().catch(() => undefined)
  }
  await loadCurrentOrgData()
})

watch(currentOrgId, () => {
  void loadCurrentOrgData()
})

// ---------- 团队 CRUD ----------
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref('')
const submitting = ref(false)
const form = reactive({ name: '', slug: '', description: '' })

function openCreate() {
  dialogMode.value = 'create'
  editingId.value = ''
  form.name = ''
  form.slug = ''
  form.description = ''
  dialogVisible.value = true
}

function openEdit(org: Organization) {
  dialogMode.value = 'edit'
  editingId.value = org.id
  form.name = org.name
  form.slug = org.slug
  form.description = org.description ?? ''
  dialogVisible.value = true
}

async function submitDialog() {
  if (!form.name.trim() || !form.slug.trim()) {
    MessagePlugin.warning(t('workspace.team.required'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
    }

    if (dialogMode.value === 'create') {
      const created = await createOrganization(payload)
      await orgStore.loadOrganizations()
      await orgStore.switchOrganization(created.id)
      MessagePlugin.success(t('workspace.team.created'))
    } else {
      await updateOrganization(editingId.value, payload)
      await orgStore.loadOrganizations()
      MessagePlugin.success(t('workspace.team.updated'))
    }
    dialogVisible.value = false
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}

async function removeOrg(org: Organization) {
  try {
    await deleteOrganization(org.id)
    MessagePlugin.success(t('workspace.team.deleted'))
    await orgStore.loadOrganizations()
    await orgStore.loadProjects()
  } catch {
    // 请求层已统一提示
  }
}

async function switchTeam(id: string) {
  await orgStore.switchOrganization(id)
}

// ---------- 成员 ----------
async function changeRole(userId: string, role: MembershipRole) {
  try {
    await updateMemberRole(currentOrgId.value, userId, role)
    MessagePlugin.success(t('workspace.member.updated'))
    await loadCurrentOrgData()
  } catch {
    // 请求层已统一提示
  }
}

async function removeUser(userId: string) {
  try {
    await removeMember(currentOrgId.value, userId)
    MessagePlugin.success(t('workspace.member.removed'))
    await loadCurrentOrgData()
  } catch {
    // 请求层已统一提示
  }
}

// ---------- 邀请 ----------
const inviteVisible = ref(false)
const inviteForm = reactive<{ email: string; role: InvitableRole }>({ email: '', role: 'MEMBER' })

function openInvite() {
  inviteForm.email = ''
  inviteForm.role = 'MEMBER'
  inviteVisible.value = true
}

async function submitInvite() {
  if (!inviteForm.email.trim()) {
    MessagePlugin.warning(t('workspace.invitation.required'))
    return
  }

  submitting.value = true
  try {
    await sendInvitation(currentOrgId.value, {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
    })
    MessagePlugin.success(t('workspace.invitation.sent'))
    inviteVisible.value = false
    await loadCurrentOrgData()
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}

async function revoke(id: string) {
  try {
    await revokeInvitation(currentOrgId.value, id)
    MessagePlugin.success(t('workspace.invitation.revoked'))
    await loadCurrentOrgData()
  } catch {
    // 请求层已统一提示
  }
}
</script>

<template>
  <div class="team">
    <t-tabs v-model="activeTab">
      <t-tab-panel value="teams" :label="t('workspace.team.tab')">
        <div class="team__bar">
          <span class="team__hint">{{ t('workspace.team.subtitle') }}</span>
          <t-button theme="primary" size="small" @click="openCreate">
            {{ t('workspace.team.create') }}
          </t-button>
        </div>

        <div v-if="orgStore.organizations.length" class="team__grid">
          <div v-for="org in orgStore.organizations" :key="org.id" class="team__card"
            :class="{ 'is-active': org.id === orgStore.currentOrganizationId }">
            <button type="button" class="team__pick" @click="switchTeam(org.id)">
              <span class="team__head">
                <span class="team__name">{{ org.name }}</span>
                <span v-if="org.id === orgStore.currentOrganizationId" class="team__tag">
                  {{ t('workspace.team.current') }}
                </span>
              </span>
              <span class="team__row">
                <span class="team__label">{{ t('layout.teamSlug') }}</span>
                <span class="team__text">{{ org.slug }}</span>
              </span>
              <span class="team__row">
                <span class="team__label">{{ t('layout.teamCreatedAt') }}</span>
                <span class="team__text">{{ org.createdAt }}</span>
              </span>
            </button>

            <div v-if="org.id === orgStore.currentOrganizationId && canManage" class="team__actions">
              <t-button variant="text" size="small" @click="openEdit(org)">
                {{ t('workspace.team.edit') }}
              </t-button>
              <t-popconfirm
                v-if="myRole === 'OWNER' || userStore.isSuperAdmin"
                :content="t('workspace.team.deleteConfirm')"
                @confirm="removeOrg(org)"
              >
                <t-button variant="text" size="small" theme="danger">
                  {{ t('workspace.team.delete') }}
                </t-button>
              </t-popconfirm>
            </div>
          </div>
        </div>

        <p v-else class="team__empty">{{ t('workspace.team.empty') }}</p>
      </t-tab-panel>

      <t-tab-panel value="members" :label="t('workspace.member.tab')">
        <p class="team__hint">
          {{ orgStore.currentOrganization?.name ?? '—' }} · {{ t('workspace.member.hint') }}
        </p>

        <div v-if="members.length" class="team__list">
          <div v-for="member in members" :key="member.id" class="team__item">
            <span class="team__item-main">
              <span class="team__item-name">
                {{ member.userId }}
                <span v-if="member.userId === userStore.user?.id" class="team__tag">
                  {{ t('workspace.member.me') }}
                </span>
              </span>
              <span class="team__item-meta">{{ member.joinedAt }}</span>
            </span>

            <span class="team__item-actions">
              <t-select
                v-if="canManage"
                :value="member.role"
                :options="ROLE_OPTIONS.map((role) => ({ label: role, value: role }))"
                size="small"
                class="team__role"
                @change="(value: unknown) => changeRole(member.userId, value as MembershipRole)"
              />
              <span v-else class="team__role-text">{{ member.role }}</span>

              <t-popconfirm
                v-if="canManage && member.role !== 'OWNER'"
                :content="t('workspace.member.removeConfirm')"
                @confirm="removeUser(member.userId)"
              >
                <t-button variant="text" size="small" theme="danger">
                  {{ t('workspace.member.remove') }}
                </t-button>
              </t-popconfirm>
            </span>
          </div>
        </div>

        <p v-else class="team__empty">{{ t('workspace.member.empty') }}</p>
      </t-tab-panel>

      <t-tab-panel value="invitations" :label="t('workspace.invitation.tab')">
        <div class="team__bar">
          <span class="team__hint">{{ t('workspace.invitation.hint') }}</span>
          <t-button v-if="canManage" theme="primary" size="small" @click="openInvite">
            {{ t('workspace.invitation.send') }}
          </t-button>
        </div>

        <div v-if="invitations.length" class="team__list">
          <div v-for="invitation in invitations" :key="invitation.id" class="team__item">
            <span class="team__item-main">
              <span class="team__item-name">{{ invitation.email }}</span>
              <span class="team__item-meta">
                {{ invitation.role }} · {{ invitation.status }}
              </span>
            </span>

            <t-popconfirm
              v-if="canManage && invitation.status === 'PENDING'"
              :content="t('workspace.invitation.revokeConfirm')"
              @confirm="revoke(invitation.id)"
            >
              <t-button variant="text" size="small" theme="danger">
                {{ t('workspace.invitation.revoke') }}
              </t-button>
            </t-popconfirm>
          </div>
        </div>

        <p v-else class="team__empty">
          {{ canManage ? t('workspace.invitation.empty') : t('workspace.invitation.noPermission') }}
        </p>
      </t-tab-panel>
    </t-tabs>

    <!-- 新建 / 编辑团队 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="dialogMode === 'create' ? t('workspace.team.create') : t('workspace.team.edit')"
      :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
      :cancel-btn="t('common.cancel')"
      width="480px"
      @confirm="submitDialog"
    >
      <t-form :data="form" label-align="top" :colon="false">
        <t-form-item :label="t('layout.teamName')">
          <t-input v-model="form.name" :placeholder="t('workspace.team.namePlaceholder')" />
        </t-form-item>
        <t-form-item :label="t('layout.teamSlug')">
          <t-input v-model="form.slug" :placeholder="t('workspace.team.slugPlaceholder')" />
        </t-form-item>
        <t-form-item :label="t('workspace.team.description')">
          <t-textarea v-model="form.description" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 发送邀请 -->
    <t-dialog
      v-model:visible="inviteVisible"
      :header="t('workspace.invitation.send')"
      :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
      :cancel-btn="t('common.cancel')"
      width="440px"
      @confirm="submitInvite"
    >
      <t-form :data="inviteForm" label-align="top" :colon="false">
        <t-form-item :label="t('login.field.email')">
          <t-input v-model="inviteForm.email" type="email" :placeholder="t('login.placeholder.email')" />
        </t-form-item>
        <t-form-item :label="t('workspace.member.role')">
          <t-select
            v-model="inviteForm.role"
            :options="INVITE_ROLE_OPTIONS.map((role) => ({ label: role, value: role }))"
          />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped lang="less">
.team {
  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 16px 0;
  }

  &__hint {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__bar &__hint {
    margin: 0;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__card {
    display: flex;
    flex-direction: column;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;

    &:hover {
      border-color: @beacon-brand-hover;
    }

    &.is-active {
      border-color: @beacon-brand;
    }
  }

  &__pick {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 16px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    background-color: transparent;
    border: 0;
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

  &__tag {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-brand;
    background-color: @beacon-brand-light;
    border-radius: @beacon-radius-m;
  }

  &__row {
    display: flex;
    gap: 8px;
    min-width: 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
  }

  &__label {
    flex: none;
    color: @beacon-text-tertiary;
  }

  &__text {
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px 8px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;

    & + & {
      border-top: 1px solid @beacon-border;
    }
  }

  &__item-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__item-name {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item-meta {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__item-actions {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  &__role {
    width: 110px;
  }

  &__role-text {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
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
