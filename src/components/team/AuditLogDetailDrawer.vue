<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AuditLog } from '@/api/types/team'
import { formatDateTime } from '@/utils/billing'
import {
  auditActionTheme,
  diffSnapshots,
  formatSnapshot,
} from '@/utils/team-presenter'

/**
 * 审计日志详情抽屉：动作上下文 + 字段级变更 + before/after 原始快照。
 * 条目不可修改，抽屉只做展示。
 */
defineOptions({ name: 'AuditLogDetailDrawer' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ log: AuditLog | null }>()
const { t } = useI18n()

const changes = computed(() => (props.log ? diffSnapshots(props.log) : []))
</script>

<template>
  <t-drawer
    v-model:visible="visible"
    size="min(640px, 100vw)"
    :header="t('workspace.auditLog.detailTitle')"
    :footer="false"
  >
    <div
      v-if="log"
      class="audit-detail"
    >
      <header class="audit-detail__head">
        <t-tag
          :theme="auditActionTheme(log.action)"
          variant="light"
        >
          {{ t(`workspace.auditLog.actionName.${log.action}`) }}
        </t-tag>
        <span class="audit-detail__entity">{{ log.entity }}</span>
      </header>

      <dl class="audit-detail__info">
        <div>
          <dt>{{ t('workspace.auditLog.entityId') }}</dt>
          <dd>{{ log.entityId || '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('workspace.auditLog.createdAt') }}</dt>
          <dd>{{ formatDateTime(log.createdAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('workspace.auditLog.actorId') }}</dt>
          <dd>{{ log.actorId ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('workspace.auditLog.projectId') }}</dt>
          <dd>{{ log.projectId ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('workspace.auditLog.ip') }}</dt>
          <dd>{{ log.ipAddress ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('workspace.auditLog.userAgent') }}</dt>
          <dd>{{ log.userAgent ?? '—' }}</dd>
        </div>
      </dl>

      <section class="audit-detail__section">
        <h4>{{ t('workspace.auditLog.changes') }}</h4>
        <div
          v-if="changes.length"
          class="audit-detail__table"
        >
          <div class="audit-detail__table-head">
            <span>{{ t('workspace.auditLog.field') }}</span>
            <span>{{ t('workspace.auditLog.before') }}</span>
            <span>{{ t('workspace.auditLog.after') }}</span>
          </div>
          <div
            v-for="change in changes"
            :key="change.field"
            class="audit-detail__row"
          >
            <span class="audit-detail__field">{{ change.field }}</span>
            <span class="audit-detail__value audit-detail__value--before">{{
              change.before
            }}</span>
            <span class="audit-detail__value audit-detail__value--after">{{
              change.after
            }}</span>
          </div>
        </div>
        <p
          v-else
          class="audit-detail__empty"
        >
          {{ t('workspace.auditLog.noChanges') }}
        </p>
      </section>

      <section class="audit-detail__section">
        <h4>{{ t('workspace.auditLog.raw') }}</h4>
        <div class="audit-detail__snapshots">
          <div>
            <span class="audit-detail__snapshot-label">{{
              t('workspace.auditLog.before')
            }}</span>
            <pre class="audit-detail__snapshot">{{
              formatSnapshot(log.before)
            }}</pre>
          </div>
          <div>
            <span class="audit-detail__snapshot-label">{{
              t('workspace.auditLog.after')
            }}</span>
            <pre class="audit-detail__snapshot">{{
              formatSnapshot(log.after)
            }}</pre>
          </div>
        </div>
      </section>
    </div>
  </t-drawer>
</template>

<style scoped lang="less">
.audit-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__entity {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__info {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 24px;
    margin: 0;

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

  &__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid @beacon-border;

    h4 {
      margin: 0;
      font-size: @beacon-font-size-section;
      font-weight: @beacon-font-weight-medium;
    }
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: 12px;
    color: @beacon-text-secondary;
  }

  &__field {
    overflow-wrap: anywhere;
    color: @beacon-text-primary;
  }

  &__value {
    overflow-wrap: anywhere;

    &--before {
      color: @beacon-text-secondary;
    }

    &--after {
      color: @beacon-text-primary;
    }
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__snapshots {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  &__snapshot-label {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    color: @beacon-text-secondary;
  }

  &__snapshot {
    max-height: 260px;
    margin: 0;
    padding: 12px;
    overflow: auto;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }
}

@media (max-width: 600px) {
  .audit-detail__info,
  .audit-detail__snapshots {
    grid-template-columns: minmax(0, 1fr);
  }

  .audit-detail__table-head,
  .audit-detail__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
