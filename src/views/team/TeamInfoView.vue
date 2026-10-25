<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { listMembers, updateOrganization } from '@/api'
import type { Membership, UpdateOrganizationParams } from '@/api/types'
import AppIcon from '@/components/AppIcon.vue'
import AvatarPickerField from '@/components/avatar/AvatarPickerField.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import TeamDangerSection from '@/components/team/TeamDangerSection.vue'
import TeamOwnerTransferDialog from '@/components/team/TeamOwnerTransferDialog.vue'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { RefreshIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { formatDateTime } from '@/utils/billing'
import { memberIdentity, shortId } from '@/utils/team-presenter'

/**
 * 团队管理 → 基本信息。
 * 查看当前团队资料（所有成员），修改（ADMIN+），转移所有权与注销团队（仅 OWNER）。
 */
defineOptions({ name: 'TeamInfoView' })

const { t } = useI18n()
const router = useRouter()
const orgStore = useOrganizationStore()
const { role, canManage } = useOrganizationRole()
const permissions = usePermissionsStore()

const org = computed(() => orgStore.currentOrganization)
const orgId = computed(() => orgStore.currentOrganizationId)
/** 转移所有权与注销团队只有所有者可以执行 */
const isOwner = computed(() => role.value === 'OWNER')

const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const members = ref<Membership[]>([])
const transferVisible = ref(false)
let generation = 0

const form = reactive({
  name: '',
  slug: '',
  description: '',
  website: '',
  logoUrl: '',
})
/** 表单初值，用于判断「有改动」与只提交变化字段 */
let baseline = snapshot()
let membersRequest = 0

function snapshot() {
  const current = orgStore.currentOrganization
  return {
    name: current?.name ?? '',
    slug: current?.slug ?? '',
    description: current?.description ?? '',
    website: current?.website ?? '',
    logoUrl: current?.logoUrl ?? '',
  }
}

function resetForm() {
  Object.assign(form, snapshot())
  baseline = snapshot()
  error.value = ''
}

// 团队切换（含保存后的刷新）时重置表单，避免把上一个团队的资料带过来
watch(() => org.value?.id, resetForm, { immediate: true, flush: 'sync' })

const dirty = computed(() =>
  (Object.keys(form) as (keyof typeof form)[]).some(
    (key) => form[key] !== baseline[key],
  ),
)

/** 所有者名称：优先用成员里的用户资料，未加载到时回退 userId 短码 */
const ownerLabel = computed(() => {
  const ownerId = org.value?.ownerId ?? ''
  const owner = members.value.find((member) => member.userId === ownerId)
  return owner ? memberIdentity(owner).name : shortId(ownerId)
})

function validate(): string {
  if (!form.name.trim()) return t('workspace.team.required')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim()))
    return t('workspace.team.slugInvalid')
  const website = form.website.trim()
  if (website && !/^https?:\/\//i.test(website))
    return t('workspace.team.websiteInvalid')
  return ''
}

/** 只提交发生变化的字段 */
function buildPayload(): UpdateOrganizationParams {
  const payload: UpdateOrganizationParams = {}
  const next = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim(),
    website: form.website.trim(),
    logoUrl: form.logoUrl.trim(),
  }
  ;(Object.keys(next) as (keyof typeof next)[]).forEach((key) => {
    if (next[key] !== baseline[key]) payload[key] = next[key]
  })
  return payload
}

async function save() {
  if (submitting.value || !canManage.value) return
  const message = validate()
  if (message) {
    error.value = message
    return
  }
  const payload = buildPayload()
  if (!Object.keys(payload).length) {
    MessagePlugin.info(t('workspace.team.unchanged'))
    return
  }

  const id = orgId.value
  const token = ++generation
  submitting.value = true
  error.value = ''
  try {
    await permissions.ensureOrganization(id, true)
    if (token !== generation || id !== orgId.value || !canManage.value) return
    await updateOrganization(id, payload)
    if (token !== generation) return
    MessagePlugin.success(t('workspace.team.updated'))
    await orgStore.loadOrganizations()
  } catch (cause) {
    if (token === generation)
      error.value =
        cause instanceof Error ? cause.message : t('workspace.team.saveFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}

/** 团队成员：用于展示所有者名称与转移所有权候选 */
async function loadMembers() {
  const id = orgId.value
  const request = ++membersRequest
  if (!id || !canManage.value) {
    members.value = []
    return
  }
  try {
    const result = await listMembers(id)
    if (request === membersRequest && id === orgId.value)
      members.value = result ?? []
  } catch {
    // 请求层已统一提示；成员缺失时所有者回退展示 userId
  }
}

async function refresh() {
  loading.value = true
  try {
    await orgStore.loadOrganizations()
    await loadMembers()
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

function onTransferred() {
  void refresh()
}

/** 注销成功：切到剩余的团队；一个都不剩时回到选择团队页 */
async function onDeleted() {
  await orgStore.loadOrganizations()
  if (!orgStore.currentOrganizationId) await router.push('/team')
}

watch(orgId, loadMembers)

onMounted(() => {
  resetForm()
  if (!orgStore.organizations.length) void refresh()
  else void loadMembers()
})
</script>

<template>
  <section class="team-info">
    <HeaderActions>
      <t-tooltip :content="t('workspace.teamSelect.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!orgId"
          :aria-label="t('workspace.teamSelect.refresh')"
          @click="refresh"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
    </HeaderActions>

    <t-alert
      v-if="!canManage"
      theme="info"
      :message="t('workspace.team.readOnlyHint')"
    />

    <t-card class="team-info__panel">
      <template #title>{{ t('workspace.team.infoTitle') }}</template>
      <p class="team-info__subtitle">{{ t('workspace.team.infoSubtitle') }}</p>

      <div
        v-if="!org"
        class="team-info__empty"
      >
        {{ loading ? t('common.loading') : t('workspace.team.empty') }}
      </div>

      <template v-else>
        <dl class="team-info__meta">
          <div>
            <dt>{{ t('workspace.team.teamId') }}</dt>
            <dd>{{ org.id }}</dd>
          </div>
          <div>
            <dt>{{ t('workspace.team.owner') }}</dt>
            <dd>{{ ownerLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('workspace.team.createdAt') }}</dt>
            <dd>{{ formatDateTime(org.createdAt) }}</dd>
          </div>
        </dl>

        <t-alert
          v-if="error"
          theme="error"
          :message="error"
          class="team-info__error"
        />

        <t-form
          class="team-info__form"
          label-align="top"
          :colon="false"
          :data="form"
        >
          <t-form-item :label="t('workspace.team.name')">
            <t-input
              v-model="form.name"
              :maxlength="100"
              :disabled="!canManage || submitting"
            />
          </t-form-item>
          <t-form-item
            :label="t('workspace.team.slug')"
            :help="t('workspace.team.slugHint')"
          >
            <t-input
              v-model="form.slug"
              :maxlength="50"
              :disabled="!canManage || submitting"
            />
          </t-form-item>
          <t-form-item :label="t('workspace.team.description')">
            <t-textarea
              v-model="form.description"
              :maxlength="500"
              :autosize="{ minRows: 2, maxRows: 5 }"
              :disabled="!canManage || submitting"
            />
          </t-form-item>
          <t-form-item :label="t('workspace.team.website')">
            <t-input
              v-model="form.website"
              :maxlength="200"
              :placeholder="t('workspace.team.websitePlaceholder')"
              :disabled="!canManage || submitting"
            />
          </t-form-item>
          <t-form-item
            :label="t('workspace.team.logo')"
            :help="t('workspace.team.logoHint')"
          >
            <!-- 单入口：点预览框打开弹窗，在里面随机选择或自己上传 -->
            <AvatarPickerField
              v-model="form.logoUrl"
              directory="teams"
              :disabled="!canManage || submitting"
            />
          </t-form-item>
        </t-form>

        <div class="team-info__actions">
          <t-button
            theme="primary"
            :disabled="!canManage || !dirty"
            :loading="submitting"
            @click="save"
          >
            {{ t('workspace.team.save') }}
          </t-button>
        </div>
      </template>
    </t-card>

    <t-card
      v-if="org"
      class="team-info__panel"
    >
      <template #title>{{ t('workspace.team.transfer') }}</template>
      <p class="team-info__subtitle">{{ t('workspace.team.transferHint') }}</p>

      <div class="team-info__owner">
        <span class="team-info__owner-label">{{
          t('workspace.team.owner')
        }}</span>
        <span class="team-info__owner-name">{{ ownerLabel }}</span>
        <t-button
          v-if="isOwner"
          class="team-info__owner-action"
          @click="transferVisible = true"
        >
          {{ t('workspace.team.transfer') }}
        </t-button>
      </div>
    </t-card>

    <TeamDangerSection
      v-if="org"
      :org="org"
      :is-owner="isOwner"
      @deleted="onDeleted"
    />

    <TeamOwnerTransferDialog
      v-model:visible="transferVisible"
      :org-id="orgId"
      :members="members"
      :owner-id="org?.ownerId ?? ''"
      @transferred="onTransferred"
    />
  </section>
</template>

<style scoped lang="less">
.team-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__subtitle {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 160px;
    color: @beacon-text-tertiary;
  }

  &__meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 24px;
    margin: 0 0 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid @beacon-border;

    dt {
      margin-bottom: 6px;
      font-size: 12px;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
      color: @beacon-text-primary;
    }
  }

  &__error {
    margin-bottom: 16px;
  }

  &__form {
    max-width: 560px;
  }

  &__actions {
    display: flex;
    justify-content: flex-start;
    padding-top: 4px;
  }

  &__owner {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__owner-label {
    color: @beacon-text-secondary;
  }

  &__owner-name {
    color: @beacon-text-primary;
  }

  &__owner-action {
    margin-left: auto;
  }
}

@media (max-width: 900px) {
  .team-info__meta {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
