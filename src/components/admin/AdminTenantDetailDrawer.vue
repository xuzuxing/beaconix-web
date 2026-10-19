<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { AdminTenant } from '@/api/types/admin'
import { formatDateTime } from '@/utils/billing'
import { adminTenantState, adminTenantTheme } from '@/utils/admin-presenter'
import { shortId } from '@/utils/team-presenter'

/**
 * 租户详情抽屉：身份信息、用量计数与当前状态。
 * 数据来自列表或 `GET /admin/tenants/:id`，组件只做展示。
 */
defineOptions({ name: 'AdminTenantDetailDrawer' })

const visible = defineModel<boolean>('visible', { required: true })
defineProps<{ tenant: AdminTenant | null }>()
const { t } = useI18n()
</script>

<template>
  <t-drawer
    v-model:visible="visible"
    size="min(520px, 100vw)"
    :header="t('adminPage.tenant.detailTitle')"
    :footer="false"
  >
    <div
      v-if="tenant"
      class="tenant-detail"
    >
      <header class="tenant-detail__head">
        <span class="tenant-detail__name">{{ tenant.name }}</span>
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
      </header>

      <t-alert
        theme="info"
        :message="
          adminTenantState(tenant) === 'active'
            ? t('adminPage.tenant.statusActiveHint')
            : t('adminPage.tenant.statusDeletedHint')
        "
      />

      <dl class="tenant-detail__info">
        <div>
          <dt>{{ t('adminPage.tenant.slug') }}</dt>
          <dd>{{ tenant.slug }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.tenant.organizationId') }}</dt>
          <dd class="tenant-detail__mono">{{ tenant.id }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.tenant.owner') }}</dt>
          <dd :title="tenant.ownerId">{{ shortId(tenant.ownerId) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.tenant.memberCount') }}</dt>
          <dd>{{ tenant.memberCount }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.tenant.projectCount') }}</dt>
          <dd>{{ tenant.projectCount }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.tenant.monitorCount') }}</dt>
          <dd>{{ tenant.monitorCount }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.common.createdAt') }}</dt>
          <dd>{{ formatDateTime(tenant.createdAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.common.updatedAt') }}</dt>
          <dd>{{ formatDateTime(tenant.updatedAt) }}</dd>
        </div>
        <div v-if="tenant.deletedAt">
          <dt>{{ t('adminPage.tenant.deletedAt') }}</dt>
          <dd>{{ formatDateTime(tenant.deletedAt) }}</dd>
        </div>
      </dl>
    </div>
  </t-drawer>
</template>

<style scoped lang="less">
.tenant-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__name {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__info {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0;

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
    }

    dt {
      flex: none;
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 0;
      overflow: hidden;
      color: @beacon-text-primary;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__mono {
    font-family: @beacon-font-family;
    font-size: @beacon-font-size-base;
  }
}
</style>
