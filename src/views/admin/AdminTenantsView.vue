<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminTenant } from '@/api/types/admin'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import AdminTenantDetailDrawer from '@/components/admin/AdminTenantDetailDrawer.vue'
import { useAdminTenants } from '@/composables/useAdminTenants'
import { RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import { adminTenantState, adminTenantTheme } from '@/utils/admin-presenter'
import { shortId } from '@/utils/team-presenter'

/** 租户管理：跨租户列表、状态筛选、软删除 / 恢复与详情抽屉。仅 SUPER_ADMIN。 */
defineOptions({ name: 'AdminTenantsView' })

const { t } = useI18n()
const userStore = useUserStore()
const {
  tenants,
  filtered,
  loading,
  error,
  keyword,
  state,
  togglingId,
  load,
  toggle,
} = useAdminTenants()

const stateOptions = computed(() => [
  { label: t('adminPage.tenant.allStates'), value: 'all' },
  { label: t('adminPage.tenant.stateActive'), value: 'active' },
  { label: t('adminPage.tenant.stateDeleted'), value: 'deleted' },
])

const counts = computed(() => ({
  total: tenants.value.length,
  active: tenants.value.filter((tenant) => tenant.active).length,
  deleted: tenants.value.filter((tenant) => !tenant.active).length,
}))

const detailVisible = ref(false)
const selected = ref<AdminTenant | null>(null)

/** 待确认的启用 / 停用目标 */
const pending = ref<AdminTenant | null>(null)
const confirmVisible = ref(false)

const confirmMessage = computed(() => {
  const tenant = pending.value
  if (!tenant) return ''
  return tenant.active
    ? t('adminPage.tenant.suspendConfirm', { name: tenant.name })
    : t('adminPage.tenant.restoreConfirm', { name: tenant.name })
})

function openDetail(tenant: AdminTenant) {
  selected.value = tenant
  detailVisible.value = true
}

function askToggle(tenant: AdminTenant) {
  pending.value = tenant
  confirmVisible.value = true
}

async function confirmToggle() {
  const tenant = pending.value
  if (!tenant) return
  const restoring = !tenant.active
  try {
    const updated = await toggle(tenant)
    if (!updated) return
    MessagePlugin.success(
      restoring
        ? t('adminPage.tenant.restoreSuccess')
        : t('adminPage.tenant.suspendSuccess'),
    )
    // 抽屉里若正展示这条租户，同步替换为新状态
    if (selected.value?.id === updated.id) selected.value = updated
    confirmVisible.value = false
    pending.value = null
  } catch {
    // 请求层已统一提示错误
  }
}

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="admin-tenants">
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
    </HeaderActions>

    <t-alert
      v-if="!userStore.isSuperAdmin"
      theme="info"
      :message="t('adminPage.common.noPermission')"
    />

    <t-card
      v-else
      class="admin-tenants__panel"
    >
      <template #title>{{ t('adminPage.tenant.title') }}</template>
      <template #actions>
        <span class="admin-tenants__counts">
          {{ t('adminPage.tenant.total') }} {{ counts.total }} ·
          {{ t('adminPage.tenant.activeCount') }} {{ counts.active }} ·
          {{ t('adminPage.tenant.deletedCount') }} {{ counts.deleted }}
        </span>
      </template>

      <p class="admin-tenants__subtitle">
        {{ t('adminPage.tenant.subtitle') }}
      </p>

      <div class="admin-tenants__filters">
        <t-input
          v-model="keyword"
          clearable
          :placeholder="t('adminPage.tenant.search')"
          :aria-label="t('adminPage.tenant.search')"
        />
        <t-select
          v-model="state"
          :options="stateOptions"
          :aria-label="t('adminPage.common.status')"
        />
      </div>

      <div
        v-if="error"
        class="admin-tenants__state"
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
        v-else-if="loading && !tenants.length"
        class="admin-tenants__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="filtered.length">
        <div class="admin-tenants__table">
          <div class="admin-tenants__table-head">
            <span>{{ t('adminPage.tenant.title') }}</span>
            <span>{{ t('adminPage.tenant.owner') }}</span>
            <span>{{ t('adminPage.tenant.memberCount') }}</span>
            <span>{{ t('adminPage.tenant.projectCount') }}</span>
            <span>{{ t('adminPage.tenant.monitorCount') }}</span>
            <span>{{ t('adminPage.common.status') }}</span>
            <span>{{ t('adminPage.common.createdAt') }}</span>
            <span>{{ t('adminPage.common.actions') }}</span>
          </div>
          <div
            v-for="tenant in filtered"
            :key="tenant.id"
            class="admin-tenants__row"
          >
            <span class="admin-tenants__identity">
              <span class="admin-tenants__name">{{ tenant.name }}</span>
              <span class="admin-tenants__slug">{{ tenant.slug }}</span>
            </span>
            <span
              class="admin-tenants__owner"
              :title="tenant.ownerId"
            >
              {{ shortId(tenant.ownerId) }}
            </span>
            <span>{{ tenant.memberCount }}</span>
            <span>{{ tenant.projectCount }}</span>
            <span>{{ tenant.monitorCount }}</span>
            <span>
              <t-tag
                size="small"
                variant="light"
                :theme="adminTenantTheme(adminTenantState(tenant))"
              >
                {{
                  adminTenantState(tenant) === 'active'
                    ? t('adminPage.tenant.stateActive')
                    : t('adminPage.tenant.stateDeleted')
                }}
              </t-tag>
            </span>
            <span class="admin-tenants__created">{{
              formatDateTime(tenant.createdAt)
            }}</span>
            <span class="admin-tenants__actions">
              <t-button
                variant="text"
                size="small"
                @click="openDetail(tenant)"
              >
                {{ t('adminPage.tenant.viewDetail') }}
              </t-button>
              <t-button
                variant="text"
                size="small"
                :loading="togglingId === tenant.id"
                @click="askToggle(tenant)"
              >
                {{
                  tenant.active
                    ? t('adminPage.tenant.suspend')
                    : t('adminPage.tenant.restore')
                }}
              </t-button>
            </span>
          </div>
        </div>
      </template>

      <div
        v-else
        class="admin-tenants__state"
      >
        <p class="admin-tenants__empty">
          {{
            tenants.length
              ? t('adminPage.common.noMatches')
              : t('adminPage.tenant.empty')
          }}
        </p>
      </div>
    </t-card>

    <AdminTenantDetailDrawer
      v-model:visible="detailVisible"
      :tenant="selected"
    />

    <t-dialog
      v-model:visible="confirmVisible"
      :header="t('adminPage.tenant.title')"
      width="min(480px, calc(100vw - 32px))"
      :confirm-btn="{
        content: t('adminPage.common.confirm'),
        loading: Boolean(togglingId),
      }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="confirmToggle"
    >
      <p class="admin-tenants__confirm">{{ confirmMessage }}</p>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.admin-tenants {
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__counts,
  &__subtitle {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 16px;
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(200px, 320px) 160px;
    gap: 8px;
  }

  &__table {
    margin-top: 16px;
    overflow-x: auto;
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns:
      minmax(180px, 1.4fr) 110px repeat(3, 80px)
      96px 150px 190px;
    gap: 12px;
    align-items: center;
    min-width: 1040px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__identity {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__slug,
  &__owner,
  &__created {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
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

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__confirm {
    margin: 0;
    color: @beacon-text-primary;
  }
}

@media (max-width: 720px) {
  .admin-tenants__filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
