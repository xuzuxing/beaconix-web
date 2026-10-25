<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SystemProbe, SystemProbeAssignments } from '@/api/types/admin'
import { shortId } from '@/utils/team-presenter'

/**
 * 重平衡结果：探针 ID → 承接的租户列表。
 * 探针名从传入的列表回捞，列表里没有的 ID 退化为短码展示。
 */
defineOptions({ name: 'SystemProbeRebalanceDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  assignments: SystemProbeAssignments
  probes: SystemProbe[]
}>()
const { t } = useI18n()

const rows = computed(() =>
  Object.entries(props.assignments ?? {}).map(([probeId, tenantIds]) => ({
    probeId,
    name:
      props.probes.find((probe) => probe.id === probeId)?.name ??
      shortId(probeId),
    tenantIds: tenantIds ?? [],
  })),
)

const served = computed(
  () => rows.value.filter((row) => row.tenantIds.length > 0).length,
)
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('adminPage.probe.rebalanceTitle')"
    width="min(560px, calc(100vw - 32px))"
    :footer="false"
  >
    <div class="probe-rebalance">
      <p
        v-if="rows.length"
        class="probe-rebalance__summary"
      >
        {{ t('adminPage.probe.rebalanceDone', { count: served }) }}
      </p>

      <div
        v-if="rows.length"
        class="probe-rebalance__list"
      >
        <article
          v-for="row in rows"
          :key="row.probeId"
          class="probe-rebalance__item"
        >
          <header class="probe-rebalance__head">
            <span class="probe-rebalance__name">{{ row.name }}</span>
            <span class="probe-rebalance__count">
              {{
                t('adminPage.probe.rebalanceAssignment', {
                  count: row.tenantIds.length,
                })
              }}
            </span>
          </header>
          <p
            v-if="row.tenantIds.length"
            class="probe-rebalance__tenants"
          >
            {{ row.tenantIds.join('、') }}
          </p>
          <p
            v-else
            class="probe-rebalance__tenants probe-rebalance__tenants--empty"
          >
            {{ t('adminPage.common.empty') }}
          </p>
        </article>
      </div>

      <p
        v-else
        class="probe-rebalance__empty"
      >
        {{ t('adminPage.probe.rebalanceEmpty') }}
      </p>
    </div>

    <template #footer>
      <t-button
        theme="primary"
        @click="visible = false"
      >
        {{ t('adminPage.common.close') }}
      </t-button>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.probe-rebalance {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__summary {
    margin: 0;
    color: @beacon-text-secondary;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 50vh;
    overflow-y: auto;
  }

  &__item {
    padding: 10px 12px;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  &__name {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__count {
    flex: none;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__tenants {
    margin: 6px 0 0;
    overflow-wrap: anywhere;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;

    &--empty {
      color: @beacon-text-disabled;
    }
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
