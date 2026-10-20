<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminPlan, CreateAdminPlanParams } from '@/api/types/admin'
import type { MonitorType } from '@/api/types'
import type { PlanCycle } from '@/api/types/billing'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { useAdminPlans } from '@/composables/useAdminPlans'
import { usePageHeader } from '@/composables/usePageHeader'
import { PlusSignIcon, RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import {
  cheapestTerm,
  enabledTerms,
  formatAmount,
  formatDateTime,
  PLAN_CYCLES,
  planCycleLabelKey,
} from '@/utils/billing'
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
  // 空数组表示禁止创建任何监控（后端语义），不是「不限制」
  if (!labels.length) return t('adminPage.plan.noTypes')
  return t('adminPage.plan.typeCount', { count: labels.length })
}

/** 列表价格：最便宜启用档价（plan.price 已是它的镜像，档位缺失时回退） */
function rowPrice(plan: AdminPlan): string {
  return formatAmount(cheapestTerm(plan)?.price ?? plan.price)
}

/** 列表时长：启用档天数，如「30 / 90 / 365 天」 */
function rowTermDays(plan: AdminPlan): string {
  const days = enabledTerms(plan).map((term) => term.durationDays)
  if (!days.length) return t('adminPage.plan.noTerm')
  return t('adminPage.plan.termDaysValue', { days: days.join(' / ') })
}

/** 档位数量标签，如「3 档」 */
function rowTermCount(plan: AdminPlan): string {
  return t('adminPage.plan.termCount', { count: plan.terms.length })
}

// ---------- 新建 / 编辑弹窗 ----------
const formVisible = ref(false)
const editing = ref<AdminPlan | null>(null)
const formError = ref('')

/** 表单里的一个计费周期档；价格按「元」输入，提交时换算成后端使用的「分」 */
interface TermDraft {
  cycle: PlanCycle
  durationDays: number
  priceYuan: number
  enabled: boolean
}

/** 新增档位时的天数预设（运营仍可改） */
const DEFAULT_TERM_DAYS: Record<PlanCycle, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  YEARLY: 365,
}

function emptyTerm(cycle: PlanCycle = 'MONTHLY'): TermDraft {
  return {
    cycle,
    durationDays: DEFAULT_TERM_DAYS[cycle],
    priceYuan: 0,
    enabled: true,
  }
}

const form = reactive({
  code: '',
  name: '',
  description: '',
  sortOrder: 0,
  maxMonitors: 0,
  maxProbes: 0,
  maxProbesPerMonitor: 0,
  maxApiKeys: 0,
  maxMembers: 0,
  maxChannels: 0,
  minInterval: 0,
  allowTenantProbe: false,
  allowStatusPage: false,
  allowedMonitorTypes: [] as MonitorType[],
  enabled: true,
  terms: [emptyTerm()] as TermDraft[],
})

function resetForm(plan: AdminPlan | null) {
  formError.value = ''
  const terms = (plan?.terms ?? []).map((term) => ({
    cycle: term.cycle,
    durationDays: term.durationDays,
    priceYuan: term.price / 100,
    enabled: term.enabled,
  }))
  Object.assign(form, {
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    sortOrder: plan?.sortOrder ?? 0,
    maxMonitors: plan?.maxMonitors ?? 0,
    maxProbes: plan?.maxProbes ?? 0,
    maxProbesPerMonitor: plan?.maxProbesPerMonitor ?? 0,
    maxApiKeys: plan?.maxApiKeys ?? 0,
    maxMembers: plan?.maxMembers ?? 0,
    maxChannels: plan?.maxChannels ?? 0,
    minInterval: plan?.minInterval ?? 0,
    allowTenantProbe: plan?.allowTenantProbe ?? false,
    allowStatusPage: plan?.allowStatusPage ?? false,
    allowedMonitorTypes: [...(plan?.allowedMonitorTypes ?? [])],
    enabled: plan?.enabled ?? true,
    // 编辑时保留停用档（PATCH 是整体替换，漏掉等于把它删掉）
    terms: terms.length ? terms : [emptyTerm()],
  })
}

/** 「添加周期」只能选尚未使用的周期 */
const availableCycles = computed(() =>
  PLAN_CYCLES.filter(
    (cycle) => !form.terms.some((term) => term.cycle === cycle),
  ),
)

/** 某一行的周期选项：自身已选的周期 + 其余未占用的周期 */
function cycleOptions(current: TermDraft) {
  return PLAN_CYCLES.filter(
    (cycle) =>
      cycle === current.cycle ||
      !form.terms.some((term) => term.cycle === cycle),
  ).map((cycle) => ({ label: t(planCycleLabelKey(cycle)), value: cycle }))
}

function addTerm() {
  const cycle = availableCycles.value[0]
  if (!cycle) return
  form.terms.push(emptyTerm(cycle))
}

function removeTerm(index: number) {
  form.terms.splice(index, 1)
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
  if (!form.terms.length) {
    formError.value = t('adminPage.plan.requiredTerm')
    return
  }

  // 档位校验：周期不重复、天数 1..3650、价格非负，且至少保留一个启用档
  const seen = new Set<PlanCycle>()
  for (const term of form.terms) {
    if (seen.has(term.cycle)) {
      formError.value = t('adminPage.plan.duplicateTerm')
      return
    }
    seen.add(term.cycle)
    const days = toNumber(term.durationDays)
    if (days < 1 || days > 3650) {
      formError.value = t('adminPage.plan.invalidTermDays')
      return
    }
    const priceYuan = Number(term.priceYuan)
    if (!Number.isFinite(priceYuan) || priceYuan < 0) {
      formError.value = t('adminPage.plan.invalidTermPrice')
      return
    }
  }
  if (!form.terms.some((term) => term.enabled)) {
    formError.value = t('adminPage.plan.requiredEnabledTerm')
    return
  }

  const params: CreateAdminPlanParams = {
    code,
    name,
    // PATCH 时 terms 整体替换：停用档一并提交，避免被当成删除
    terms: form.terms.map((term) => ({
      cycle: term.cycle,
      durationDays: toNumber(term.durationDays),
      price: Math.max(0, Math.round(Number(term.priceYuan) * 100)),
      enabled: term.enabled,
      sortOrder: PLAN_CYCLES.indexOf(term.cycle) + 1,
    })),
    sortOrder: toNumber(form.sortOrder),
    maxMonitors: toNumber(form.maxMonitors),
    maxProbes: toNumber(form.maxProbes),
    maxProbesPerMonitor: toNumber(form.maxProbesPerMonitor),
    maxApiKeys: toNumber(form.maxApiKeys),
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
            <span>{{ t('adminPage.plan.termDays') }}</span>
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
            <span class="admin-plans__price">
              {{ rowPrice(plan) }}
              <span
                v-if="plan.code.trim().toUpperCase() !== 'FREE'"
                class="admin-plans__price-from"
                >{{ t('adminPage.plan.priceFrom') }}</span
              >
            </span>
            <span class="admin-plans__muted">
              {{ rowTermDays(plan) }}
              <span class="admin-plans__term-count">{{
                rowTermCount(plan)
              }}</span>
            </span>
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
                    : t('adminPage.plan.noTypes')
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
          {{ t('adminPage.plan.termsSection') }}
        </div>
        <p class="admin-plans__form-hint">
          {{ t('adminPage.plan.termsHint') }}
        </p>
        <div class="admin-plans__terms">
          <div
            v-for="(term, index) in form.terms"
            :key="index"
            class="admin-plans__term-row"
          >
            <t-select
              v-model="term.cycle"
              class="admin-plans__term-cycle"
              :options="cycleOptions(term)"
              :aria-label="t('adminPage.plan.cycle')"
            />
            <t-input-number
              v-model="term.durationDays"
              :min="1"
              :max="3650"
              :step="1"
              theme="normal"
              :suffix="t('adminPage.plan.daySuffix')"
              :aria-label="t('adminPage.plan.termDays')"
            />
            <t-input-number
              v-model="term.priceYuan"
              :min="0"
              :step="1"
              theme="normal"
              :suffix="t('adminPage.plan.priceUnit')"
              :aria-label="t('adminPage.plan.termPrice')"
            />
            <t-switch
              v-model="term.enabled"
              :aria-label="t('adminPage.plan.termEnabled')"
            />
            <t-button
              variant="text"
              theme="danger"
              size="small"
              :disabled="form.terms.length <= 1"
              @click="removeTerm(index)"
            >
              {{ t('adminPage.plan.removeTerm') }}
            </t-button>
          </div>
          <t-button
            variant="outline"
            size="small"
            :disabled="!availableCycles.length"
            @click="addTerm"
          >
            <template #icon><AppIcon :icon="PlusSignIcon" /></template>
            {{ t('adminPage.plan.addTerm') }}
          </t-button>
        </div>

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
          <t-form-item :label="t('adminPage.plan.maxProbesPerMonitor')">
            <t-input-number
              v-model="form.maxProbesPerMonitor"
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
          <t-form-item :label="t('adminPage.plan.maxApiKeys')">
            <t-input-number
              v-model="form.maxApiKeys"
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

  &__form-hint {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
  }

  &__terms {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 4px;
  }

  &__term-row {
    display: grid;
    grid-template-columns: 120px 140px 140px auto auto;
    gap: 8px;
    align-items: center;
    width: 100%;
  }

  &__form-switches {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0 16px;
  }
}
</style>
