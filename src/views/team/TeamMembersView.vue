<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { removeMember, revokeInvitation, updateMemberRole } from '@/api'
import type { Invitation, Membership, MembershipRole } from '@/api/types'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import MemberInviteDialog from '@/components/team/MemberInviteDialog.vue'
import MemberProjectPermissionsDrawer from '@/components/team/MemberProjectPermissionsDrawer.vue'
import InvitationScope from '@/components/team/InvitationScope.vue'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useTeamMembers } from '@/composables/useTeamMembers'
import { PlusSignIcon, RefreshIcon, Search01Icon } from '@/icons'
import { useOrganizationStore, useUserStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import { permissionEpoch } from '@/utils/access-context'
import {
  ASSIGNABLE_ROLES,
  MEMBER_ROLES,
  invitationTheme,
  isInvitationExpired,
  isPendingInvitation,
  memberIdentity,
  memberPermissions,
  selectInvitations,
  selectMembers,
} from '@/utils/team-presenter'

/**
 * 团队管理 → 团队成员。
 * 成员列表（搜索 / 角色筛选 / 分页）+ 角色调整 / 移除，以及待处理邀请的查看与撤销。
 * 邀请、调整角色与移除均需要 ADMIN+。
 */
defineOptions({ name: 'TeamMembersView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()
const userStore = useUserStore()
const { canManage, canGrantAdmin } = useOrganizationRole()

const orgId = computed(() => orgStore.currentOrganizationId)
const { members, invitations, loading, error, invitationsDenied, pendingKey, load, act } =
  useTeamMembers(orgId, canManage)

const keyword = ref('')
const roleFilter = ref<MembershipRole | 'all'>('all')
const pageSize = ref(10)
const page = ref(1)
const inviteVisible = ref(false)
const permissionsVisible = ref(false)
const permissionUserId = ref('')
const roleChange = ref<{ member: Membership; role: MembershipRole; orgId: string } | null>(null)
const roleChangeVisible = computed({
  get: () => roleChange.value !== null,
  set: (value: boolean) => {
    if (!value) roleChange.value = null
  },
})
watch(
  () => [orgId.value, permissionEpoch.value],
  () => {
    roleChange.value = null
    inviteVisible.value = false
    permissionsVisible.value = false
  },
  { flush: 'sync' },
)

const filtered = computed(() => selectMembers(members.value, keyword.value, roleFilter.value))
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))
const rows = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)
const pendingInvitations = computed(() =>
  selectInvitations(invitations.value).filter(isPendingInvitation),
)

const roleFilterOptions = computed(() => [
  { label: t('workspace.member.allRoles'), value: 'all' },
  ...MEMBER_ROLES.map((role) => ({ label: t(`workspace.member.roleOption.${role}`), value: role })),
])
const assignableOptions = computed(() =>
  ASSIGNABLE_ROLES.filter((role) => role !== 'ADMIN' || canGrantAdmin.value).map((role) => ({
    label: t(`workspace.member.roleOption.${role}`),
    value: role,
  })),
)

// 筛选条件或每页条数变化时回到第一页
watch([keyword, roleFilter, pageSize], () => {
  page.value = 1
})
// 列表变短（移除成员 / 切换团队）时收敛页码
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

function identity(member: Membership) {
  return memberIdentity(member)
}

function permissions(member: Membership) {
  return memberPermissions(member, {
    currentUserId: userStore.user?.id,
    canManage: canManage.value,
    canGrantAdmin: canGrantAdmin.value,
  })
}

function openProjectPermissions(member: Membership) {
  if (!canManage.value || ['OWNER', 'ADMIN'].includes(member.role)) return
  permissionUserId.value = member.userId
  permissionsVisible.value = true
}

/** 不能操作时的原因提示（自己 / 所有者） */
function lockHint(member: Membership): string {
  const item = permissions(member)
  if (item.isSelf) return t('workspace.member.selfHint')
  if (item.isOwner) return t('workspace.member.ownerHint')
  return ''
}

async function changeRole(member: Membership, value: unknown) {
  if (!permissions(member).canChangeRole) return
  const role = String(value) as MembershipRole
  if (!ASSIGNABLE_ROLES.includes(role) || role === member.role) return
  if (role === 'ADMIN' && !canGrantAdmin.value) return
  roleChange.value = { member, role, orgId: orgId.value }
}

async function confirmRoleChange() {
  const change = roleChange.value
  if (!change || change.orgId !== orgId.value) return
  const { member, role } = change
  if (!permissions(member).canChangeRole || (role === 'ADMIN' && !canGrantAdmin.value)) return
  await act(member.userId, async () => {
    if (
      roleChange.value !== change ||
      !permissions(member).canChangeRole ||
      (role === 'ADMIN' && !canGrantAdmin.value)
    )
      return
    try {
      await updateMemberRole(change.orgId, member.userId, role)
      MessagePlugin.success(t('workspace.member.updated'))
      roleChange.value = null
      window.dispatchEvent(new Event('beacon-permissions-changed'))
    } catch {
      // The request layer reports the server rejection.
    } finally {
      // 无论成功与否都重载，保证下拉与后端一致
      await load()
    }
  })
}

function remove(member: Membership) {
  if (!permissions(member).canRemove) return
  void act(member.userId, async () => {
    try {
      await removeMember(orgId.value, member.userId)
      MessagePlugin.success(t('workspace.member.removed'))
    } catch {
      // 请求层已统一提示
    } finally {
      await load()
    }
  })
}

function revoke(invitation: Invitation) {
  if (!canManage.value) return
  void act(invitation.id, async () => {
    try {
      await revokeInvitation(orgId.value, invitation.id)
      MessagePlugin.success(t('workspace.invitation.revoked'))
    } catch {
      // 请求层已统一提示
    } finally {
      await load()
    }
  })
}

function paginate(info: { current: number; pageSize: number }) {
  page.value = info.current
  pageSize.value = info.pageSize
}

/** 清空搜索与角色筛选 */
function clearFilters() {
  keyword.value = ''
  roleFilter.value = 'all'
}
</script>

<template>
  <section class="members">
    <t-dialog
      v-model:visible="roleChangeVisible"
      :header="t('workspace.member.changeRole')"
      width="min(480px, calc(100vw - 32px))"
      :confirm-btn="{ content: t('common.confirm'), loading: !!pendingKey }"
      @confirm="confirmRoleChange"
    >
      <p>{{ t('access.roleImpact') }}</p>
      <p v-if="roleChange">
        {{ identity(roleChange.member).name }}:
        {{ t(`workspace.member.roleOption.${roleChange.member.role}`) }} →
        {{ t(`workspace.member.roleOption.${roleChange.role}`) }}
      </p>
    </t-dialog>
    <HeaderActions>
      <t-tooltip :content="t('workspace.teamSelect.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!orgId"
          :aria-label="t('workspace.teamSelect.refresh')"
          @click="load"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <t-button v-if="canManage" :disabled="!orgId" @click="inviteVisible = true"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('workspace.member.invite') }}</t-button
      >
    </HeaderActions>

    <t-alert v-if="!canManage" theme="info" :message="t('workspace.member.noPermission')" />

    <t-card class="members__panel">
      <template #title>{{ t('workspace.member.title') }}</template>
      <template #actions>
        <span class="members__scope">{{ orgStore.currentOrganization?.name ?? '—' }}</span>
      </template>

      <div class="members__filters">
        <t-input
          v-model="keyword"
          clearable
          :placeholder="t('workspace.member.searchPlaceholder')"
          :aria-label="t('workspace.member.searchPlaceholder')"
          ><template #prefix-icon><AppIcon :icon="Search01Icon" /></template
        ></t-input>
        <t-select
          v-model="roleFilter"
          :options="roleFilterOptions"
          :aria-label="t('workspace.member.allRoles')"
        />
      </div>

      <div v-if="error" class="members__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('workspace.member.reset') }}</t-button>
      </div>

      <div v-else-if="loading && !members.length" class="members__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="rows.length">
        <div class="members__table">
          <div class="members__table-head">
            <span>{{ t('workspace.member.title') }}</span>
            <span>{{ t('workspace.member.role') }}</span>
            <span>{{ t('workspace.member.joinedAt') }}</span>
            <span>{{ t('workspace.member.remove') }}</span>
          </div>
          <article v-for="member in rows" :key="member.id" class="member-row">
            <div class="member-row__identity">
              <t-avatar size="32px">{{ identity(member).initial }}</t-avatar>
              <div class="member-row__text">
                <span class="member-row__name">
                  {{ identity(member).name }}
                  <t-tag v-if="permissions(member).isSelf" size="small" variant="light-outline">
                    {{ t('workspace.member.me') }}
                  </t-tag>
                </span>
                <span class="member-row__sub">{{ identity(member).email || member.userId }}</span>
              </div>
            </div>

            <div class="member-row__role">
              <t-select
                v-if="permissions(member).canChangeRole"
                :value="member.role"
                :options="assignableOptions"
                size="small"
                :loading="pendingKey === member.userId"
                :aria-label="t('workspace.member.changeRole')"
                @change="(value: unknown) => changeRole(member, value)"
              />
              <t-tag v-else size="small" variant="light-outline">
                {{ t(`workspace.member.roleOption.${member.role}`) }}
              </t-tag>
            </div>

            <span class="member-row__joined">{{ formatDateTime(member.joinedAt) }}</span>

            <div class="member-row__actions">
              <t-button
                v-if="canManage && !['OWNER', 'ADMIN'].includes(member.role)"
                variant="text"
                size="small"
                @click="openProjectPermissions(member)"
                >{{ t('access.projectPermissions') }}</t-button
              >
              <t-popconfirm
                v-if="permissions(member).canRemove"
                :content="t('workspace.member.removeConfirm')"
                @confirm="remove(member)"
              >
                <t-button
                  variant="text"
                  theme="danger"
                  size="small"
                  :loading="pendingKey === member.userId"
                >
                  {{ t('workspace.member.remove') }}
                </t-button>
              </t-popconfirm>
              <span v-else class="member-row__locked">{{ lockHint(member) || '—' }}</span>
            </div>
          </article>
        </div>

        <t-pagination
          :total="filtered.length"
          :current="page"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>

      <div v-else class="members__state">
        <p class="members__empty">
          {{ members.length ? t('workspace.member.noMatches') : t('workspace.member.empty') }}
        </p>
        <t-button v-if="members.length" variant="outline" @click="clearFilters">
          {{ t('workspace.member.reset') }}
        </t-button>
      </div>
    </t-card>

    <t-card v-if="canManage" class="members__panel">
      <template #title>{{ t('workspace.invitation.listTitle') }}</template>
      <p class="members__hint">{{ t('workspace.invitation.listHint') }}</p>

      <template v-if="pendingInvitations.length">
        <div v-for="invitation in pendingInvitations" :key="invitation.id" class="invite-row">
          <div class="invite-row__identity">
            <span class="invite-row__email">{{ invitation.email }}</span>
            <span class="invite-row__expires">
              {{ t('workspace.invitation.expiresAt') }} {{ formatDateTime(invitation.expiresAt) }}
            </span>
          </div>
          <t-tag size="small" variant="light-outline">
            {{ t(`workspace.member.roleOption.${invitation.role}`) }}
          </t-tag>
          <InvitationScope :invitation="invitation" />
          <t-tag
            size="small"
            variant="light"
            :theme="
              invitationTheme(isInvitationExpired(invitation) ? 'EXPIRED' : invitation.status)
            "
          >
            {{
              t(
                `workspace.invitation.statusName.${
                  isInvitationExpired(invitation) ? 'EXPIRED' : invitation.status
                }`,
              )
            }}
          </t-tag>
          <t-popconfirm
            :content="t('workspace.invitation.revokeConfirm')"
            @confirm="revoke(invitation)"
          >
            <t-button variant="text" size="small" :loading="pendingKey === invitation.id">
              {{ t('workspace.invitation.revoke') }}
            </t-button>
          </t-popconfirm>
        </div>
      </template>
      <p v-else class="members__empty">
        {{
          invitationsDenied
            ? t('workspace.invitation.noPermission')
            : t('workspace.invitation.empty')
        }}
      </p>
    </t-card>

    <MemberInviteDialog
      v-model:visible="inviteVisible"
      :org-id="orgId"
      :members="members"
      :invitations="invitations"
      @saved="load"
    />
    <MemberProjectPermissionsDrawer
      v-model:visible="permissionsVisible"
      :org-id="orgId"
      :user-id="permissionUserId"
      @saved="load"
    />
  </section>
</template>

<style scoped lang="less">
.members {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__scope {
    color: @beacon-text-secondary;
  }

  &__hint {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 160px;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .member-row {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 150px 150px 180px;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: 12px;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

.member-row {
  &__identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    font-weight: 600;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__sub {
    overflow: hidden;
    font-size: 12px;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__role {
    min-width: 0;
  }

  &__joined {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  &__locked {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}

.invite-row {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 110px minmax(100px, 1fr) 96px 72px;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid @beacon-border;

  &__identity {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__email {
    overflow: hidden;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__expires {
    font-size: 12px;
    color: @beacon-text-secondary;
  }
}

@media (max-width: 1200px) {
  .members__table-head,
  .members .member-row {
    grid-template-columns: minmax(160px, 1fr) 140px 96px;
  }
  .members__table-head > :nth-child(3),
  .member-row__joined {
    display: none;
  }
}

@media (max-width: 600px) {
  .members__filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .members__table-head {
    display: none;
  }
  .members .member-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .member-row__actions {
    justify-content: flex-start;
  }
  .invite-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}
</style>
