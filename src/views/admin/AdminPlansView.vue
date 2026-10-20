<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminPlan, CreateAdminPlanParams } from '@/api/types/admin'
import type { MonitorType } from '@/api/types'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { useAdminPlans } from '@/composables/useAdminPlans'
import { usePageHeader } from '@/composables/usePageHeader'
import { PlusSignIcon, RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatAmount, formatDateTime } from '@/utils/billing'
import { MONITOR_TYPE_OPTIONS } from '@/utils/monitor-config'

/**
 * 管理后台 · 套餐配置（仅 SUPER_ADMIN）。
 * 不进侧边栏：入口是订单管理页动作区的「套餐管理」，作为二级页面打开，
 * 标题栏左侧的返回按钮回到订单管理。
 *
 * 与用户侧套餐目录的区别：这里能看到停用套餐，并能维护配额、特性开关与协议白名单。
 */
defineOptions({ name: 'AdminPlansView' })

const { t } = useI18n()
const userStore = useUserStore()
const {
  plans,
  loading,
  error,
  submitting,
  actingId,
  load,
  create,
  update,
  remove,
} = useAdminPlans()

usePageHeader({
  title: t('adminPage.plan.title'),
  back: '/admin/orders',
})

/** 协议多选项：标签复用监控项表单的协议文案 */
const monitorTypeOptions = computed(() =>
  MONITOR_TYPE_OPTIONS.map((option) => ({
    label: t(option.labelKey),
    value: option.value,
  })),
)

/** 协议白名单展示：空数组按「不限制」处理（后端可能不返回该字段） */
function typeLabels(plan: AdminPlan): string[] {
  const allowed = plan.allowedMonitorTypes ?? []
  const labels = monitorTypeOptions.value
    .filter((option) => allowed.includes(option.value))
    .map((option) => option.label)
  return labels
}

function typeSummary(plan: AdminPlan): string {
  const labels = typeLabels(plan)
  if (!labels.length) return t('adminPage.plan.allTypes')
  return t('adminPage.plan.typeCount', { count: labels.length })
}

// ---------- 新建 / 编辑弹窗 ----------
const formVisible = ref(false)
const editing = ref<AdminPlan | null>(null)
const formError = ref('')

/** 表单模型：价格按「元」输入，提交时换算成后端使用的「分」 */
const form = reactive({
  code: '',
  name: '',
  description: '',
  priceYuan: 0,
  durationDays: 30,
  sortOrder: 0,
  maxMonitors: 0,
  maxProbes: 0,
  maxMembers: 0,
  maxChannels: 0,
  minInterval: 0,
  allowTenantProbe: false,
  allowStatusPage: false,
  allowedMonitorTypes: [] as MonitorType[],
  enabled: true,
})

function resetForm(plan: AdminPlan | null) {
  formError.value = ''
  Object.assign(form, {
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    priceYuan: (plan?.price ?? 0) / 100,
    durationDays: plan?.durationDays ?? 30,
    sortOrder: plan?.sortOrder ?? 0,
    maxMonitors: plan?.maxMonitors ?? 0,
    maxProbes: plan?.maxProbes ?? 0,
    maxMembers: plan?.maxMembers ?? 0,
    maxChannels: plan?.maxChannels ?? 0,
    minInterval: plan?.minInterval ?? 0,
    allowTenantProbe: plan?.allowTenantProbe ?? false,
    allowStatusPage: plan?.allowStatusPage ?? false,
    allowedMonitorTypes: [...(plan?.allowedMonitorTypes ?? [])],
    enabled: plan?.enabled ?? true,
  })
}

function openCreate() {
  editing.value = null
  resetForm(null)
  formVisible.value = true
}

function openEdit(plan: AdminPlan) {
  editing.value = plan
  resetForm(plan)
  formVisible.value = true
}

/** 表单里的数字控件允许清空，统一兜底成 0 并夹到非负 */
function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

async function submitForm() {
  const code = form.code.trim().toUpperCase()
  if (!code) {
    formError.value = t('adminPage.plan.requiredCode')
    return
  }
  const name = form.name.trim()
  if (!name) {
    formError.value = t('adminPage.plan.requiredName')
    return
  }
  const durationDays = toNumber(form.durationDays)
  if (durationDays <= 0) {
    formError.value = t('adminPage.plan.requiredDuration')
    return
  }

  const priceYuan = Number(form.priceYuan)
  const params: CreateAdminPlanParams = {
    code,
    name,
    price: Math.max(
      0,
      Math.round(Number.isFinite(priceYuan) ? priceYuan * 100 : 0),
    ),
    durationDays,
    sortOrder: toNumber(form.sortOrder),
    maxMonitors: toNumber(form.maxMonitors),
    maxProbes: toNumber(form.maxProbes),
    maxMembers: toNumber(form.maxMembers),
    maxChannels: toNumber(form.maxChannels),
    minInterval: toNumber(form.minInterval),
    allowTenantProbe: form.allowTenantProbe,
    allowStatusPage: form.allowStatusPage,
    allowedMonitorTypes: [...form.allowedMonitorTypes],
    enabled: form.enabled,
  }
  params.description = form.description.trim() || null

  const target = editing.value
  const done = target ? await update(target.id, params) : await create(params)
  if (!done) return

  MessagePlugin.success(
    t(target ? 'adminPage.plan.updated' : 'adminPage.plan.created'),
  )
  formVisible.value = false
}

/** 启用 / 停用：停用后该套餐不再出现在用户侧套餐目录，已购订阅不受影响 */
async function toggleEnabled(plan: AdminPlan) {
  const done = await update(plan.id, { enabled: !plan.enabled })
  if (!done) return
  MessagePlugin.success(
    t(plan.enabled ? 'adminPage.plan.disabled' : 'adminPage.plan.enabled'),
  )
}

// ---------- 删除确认 ----------
const removeVisible = ref(false)
const removeTarget = ref<AdminPlan | null>(null)

function askRemove(plan: AdminPlan) {
  removeTarget.value = plan
  removeVisible.value = true
}

async function confirmRemove() {
  const target = removeTarget.value
  removeVisible.value = false
  if (!target) return
  const done = await remove(target.id)
  if (!done) return
  MessagePlugin.success(t('adminPage.plan.deleted'))
}

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="admin-plans">
    <HeaderActions>
      <t-tooltip :content="t('adminPage.common.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!userStore.isSuperAdmin"
          :aria-label="t('adminPage.common.refresh')"
          @click="load"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
      <t-button
        theme="primary"
        :disabled="!userStore.isSuperAdmin"
        @click="openCreate"
      >
        <template #icon><AppIcon :icon="PlusSignIcon" /></template>
        {{ t('adminPage.plan.create') }}
      </t-button>
    </HeaderActions>

    <t-alert
      v-if="!userStore.isSuperAdmin"
      theme="info"
      :message="t('adminPage.common.noPermission')"
    />

    <t-card
      v-else
      class="admin-plans__panel"
    >
      <template #title>{{ t('adminPage.plan.title') }}</template>
      <template #actions>
        <span class="admin-plans__total">{{ plans.length }}</span>
      </template>

      <p class="admin-plans__subtitle">{{ t('adminPage.plan.subtitle') }}</p>

      <div
        v-if="error"
        class="admin-plans__state"
      >
        <t-alert
          theme="error"
          :message="error"
        />
        <t-button
          variant="outline"
          @click="load"
          >{{ t('adminPage.common.refresh') }}</t-button
        >
      </div>

      <div
        v-else-if="loading && !plans.length"
        class="admin-plans__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="plans.length">
        <div class="admin-plans__table">
          <div class="admin-plans__table-head">
            <span>{{ t('adminPage.plan.name') }}</span>
            <span>{{ t('adminPage.plan.price') }}</span>
            <span>{{ t('adminPage.plan.durationDays') }}</span>
            <span>{{ t('adminPage.plan.quota') }}</span>
            <span>{{ t('adminPage.plan.features') }}</span>
            <span>{{ t('adminPage.plan.allowedMonitorTypes') }}</span>
            <span>{{ t('adminPage.common.status') }}</span>
            <span>{{ t('adminPage.common.updatedAt') }}</span>
            <span>{{ t('adminPage.common.actions') }}</span>
          </div>
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="admin-plans__row"
          >
            <span class="admin-plans__name">
              <span class="admin-plans__name-text">{{ plan.name }}</span>
              <span class="admin-plans__code">{{ plan.code }}</span>
            </span>
            <span class="admin-plans__price">{{
              formatAmount(plan.price)
            }}</span>
            <span class="admin-plans__muted">{{
              t('adminPage.plan.days', { days: plan.durationDays })
            }}</span>
            <span class="admin-plans__muted">
              {{
                t('adminPage.plan.quotaLine', {
                  monitors: plan.maxMonitors,
                  probes: plan.maxProbes,
                  members: plan.maxMembers,
                  channels: plan.maxChannels,
                  interval: plan.minInterval,
                })
              }}
            </span>
            <span class="admin-plans__features">
              <t-tag
                size="small"
                variant="light"
                :theme="plan.allowTenantProbe ? 'success' : 'default'"
              >
                {{
                  plan.allowTenantProbe
                    ? t('adminPage.plan.tenantProbeOn')
                    : t('adminPage.plan.tenantProbeOff')
                }}
              </t-tag>
              <t-tag
                size="small"
                variant="light"
                :theme="plan.allowStatusPage ? 'success' : 'default'"
              >
                {{
                  plan.allowStatusPage
                    ? t('adminPage.plan.statusPageOn')
                    : t('adminPage.plan.statusPageOff')
                }}
              </t-tag>
            </span>
            <span class="admin-plans__types">
              <t-tooltip
                :content="
                  typeLabels(plan).length
                    ? typeLabels(plan).join(' · ')
                    : t('adminPage.plan.allTypes')
                "
              >
                <span class="admin-plans__muted">{{ typeSummary(plan) }}</span>
              </t-tooltip>
            </span>
            <span>
              <t-tag
                size="small"
                variant="light"
                :theme="plan.enabled ? 'success' : 'default'"
              >
                {{
                  plan.enabled
                    ? t('adminPage.common.active')
                    : t('adminPage.common.inactive')
                }}
              </t-tag>
            </span>
            <span class="admin-plans__muted">{{
              formatDateTime(plan.updatedAt)
            }}</span>
            <span class="admin-plans__actions">
              <t-button
                variant="text"
                size="small"
                @click="openEdit(plan)"
              >
                {{ t('adminPage.plan.edit') }}
              </t-button>
              <t-button
                variant="text"
                size="small"
                :loading="actingId === plan.id"
                @click="toggleEnabled(plan)"
              >
                {{
                  plan.enabled
                    ? t('adminPage.plan.disable')
                    : t('adminPage.plan.enable')
                }}
              </t-button>
              <t-button
                variant="text"
                size="small"
                theme="danger"
                :loading="actingId === plan.id"
                @click="askRemove(plan)"
              >
                {{ t('adminPage.plan.delete') }}
              </t-button>
            </span>
          </div>
        </div>
      </template>

      <div
        v-else
        class="admin-plans__state"
      >
        <p class="admin-plans__empty">{{ t('adminPage.plan.empty') }}</p>
        <t-button
          theme="primary"
          @click="openCreate"
        >
          {{ t('adminPage.plan.create') }}
        </t-button>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="formVisible"
      :header="editing ? t('adminPage.plan.edit') : t('adminPage.plan.create')"
      width="min(640px, calc(100vw - 32px))"
      :confirm-btn="{
        content: t('adminPage.common.confirm'),
        loading: submitting,
      }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="submitForm"
    >
      <t-alert
        v-if="formError"
        theme="error"
        :message="formError"
        class="admin-plans__error"
      />

      <t-form
        label-align="top"
        :colon="false"
        :data="form"
      >
        <div class="admin-plans__form-section">
          {{ t('adminPage.plan.basicSection') }}
        </div>
        <div class="admin-plans__form-grid">
          <t-form-item :label="t('adminPage.plan.code')">
            <t-input
              v-model="form.code"
              :maxlength="32"
              :disabled="Boolean(editing)"
              :placeholder="t('adminPage.plan.codePlaceholder')"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.name')">
            <t-input
              v-model="form.name"
              :maxlength="60"
              :placeholder="t('adminPage.plan.namePlaceholder')"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.price')">
            <t-input-number
              v-model="form.priceYuan"
              :min="0"
              :step="1"
              theme="normal"
              :suffix="t('adminPage.plan.priceUnit')"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.durationDays')">
            <t-input-number
              v-model="form.durationDays"
              :min="1"
              :max="3650"
              :step="1"
              theme="normal"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.sortOrder')">
            <t-input-number
              v-model="form.sortOrder"
              :min="0"
              :max="9999"
              :step="1"
              theme="normal"
            />
          </t-form-item>
        </div>
        <t-form-item :label="t('adminPage.plan.description')">
          <t-textarea
            v-model="form.description"
            :maxlength="300"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="t('adminPage.plan.descriptionPlaceholder')"
          />
        </t-form-item>

        <div class="admin-plans__form-section">
          {{ t('adminPage.plan.quotaSection') }}
        </div>
        <div class="admin-plans__form-grid">
          <t-form-item :label="t('adminPage.plan.maxMonitors')">
            <t-input-number
              v-model="form.maxMonitors"
              :min="0"
              :step="1"
              theme="normal"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.maxProbes')">
            <t-input-number
              v-model="form.maxProbes"
              :min="0"
              :step="1"
              theme="normal"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.maxMembers')">
            <t-input-number
              v-model="form.maxMembers"
              :min="0"
              :step="1"
              theme="normal"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.maxChannels')">
            <t-input-number
              v-model="form.maxChannels"
              :min="0"
              :step="1"
              theme="normal"
            />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.minInterval')">
            <t-input-number
              v-model="form.minInterval"
              :min="0"
              :step="1"
              theme="normal"
            />
          </t-form-item>
        </div>

        <div class="admin-plans__form-section">
          {{ t('adminPage.plan.featureSection') }}
        </div>
        <t-form-item :label="t('adminPage.plan.allowedMonitorTypes')">
          <t-select
            v-model="form.allowedMonitorTypes"
            multiple
            clearable
            :options="monitorTypeOptions"
            :placeholder="t('adminPage.plan.allowedMonitorTypesPlaceholder')"
          />
        </t-form-item>
        <div class="admin-plans__form-switches">
          <t-form-item :label="t('adminPage.plan.allowTenantProbe')">
            <t-switch v-model="form.allowTenantProbe" />
          </t-form-item>
          <t-form-item :label="t('adminPage.plan.allowStatusPage')">
            <t-switch v-model="form.allowStatusPage" />
          </t-form-item>
          <t-form-item :label="t('adminPage.common.status')">
            <t-switch v-model="form.enabled" />
          </t-form-item>
        </div>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="removeVisible"
      :header="t('adminPage.plan.delete')"
      width="min(520px, calc(100vw - 32px))"
      :confirm-btn="{
        content: t('adminPage.common.confirm'),
        theme: 'danger',
        loading: Boolean(actingId),
      }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="confirmRemove"
    >
      <p class="admin-plans__confirm">
        {{
          t('adminPage.plan.deleteConfirm', {
            name: removeTarget?.name ?? '',
          })
        }}
      </p>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.admin-plans {
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__total {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__table {
    overflow-x: auto;
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns:
      minmax(150px, 1.2fr) 90px 70px minmax(200px, 1.8fr)
      minmax(150px, 1.2fr) 100px 90px 150px 210px;
    gap: 12px;
    align-items: center;
    min-width: 1200px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name-text {
    overflow: hidden;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__code {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &__price {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__muted {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__features {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__types {
    min-width: 0;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty,
  &__confirm {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__confirm {
    color: @beacon-text-primary;
  }

  &__error {
    margin-bottom: 16px;
  }

  &__form-section {
    margin: 8px 0 12px;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;

    &:not(:first-child) {
      padding-top: 12px;
      border-top: 1px solid @beacon-border;
    }
  }

  &__form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0 16px;
  }

  &__form-switches {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0 16px;
  }
}
</style>
