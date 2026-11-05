<script setup lang="ts">
import { computed, ref } from 'vue'
import { useIntervalFn, useNow } from '@vueuse/core'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'

import { useMonitorCapacity } from '@/composables/useMonitorCapacity'
import { useOrganizationStore } from '@/stores'
import { formatMonitorTime } from '@/utils/monitor-presenter'

const emit = defineEmits<{ upgrade: [] }>()
const org = useOrganizationStore()
const { t, locale } = useI18n()
const {
  capacity,
  monitors,
  selected,
  loading,
  saving,
  error,
  monitorsError,
  canManage,
  dirty,
  load,
  save,
} = useMonitorCapacity(computed(() => org.currentOrganizationId))
const search = ref('')
const now = useNow({ scheduler: (callback) => useIntervalFn(callback, 1000) })
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const time = (value: string) =>
  `${formatMonitorTime(value, locale.value, timeZone)} (${timeZone})`
const rows = computed(() => {
  const data = capacity.value
  if (!data) return []
  const byId = new Map(monitors.value.map((monitor) => [monitor.id, monitor]))
  const deadlines = new Map(data.monitorDeadlines.map((row) => [row.id, row]))
  const ids = new Set([
    ...byId.keys(),
    ...data.selectedMonitorIds,
    ...data.retainedMonitorIds,
    ...data.restrictedMonitorIds,
    ...deadlines.keys(),
  ])
  const query = search.value.trim().toLocaleLowerCase()
  return [...ids]
    .map((id) => {
      const monitor = byId.get(id)
      const deadline = deadlines.get(id)
      const restricted =
        data.restrictedMonitorIds.includes(id) ||
        (!!deadline &&
          Date.parse(deadline.quotaGraceEndsAt) <= now.value.getTime())
      return {
        id,
        name: monitor?.name ?? t('monitorCapacity.unavailable', { id }),
        projectName: monitor?.projectName ?? '',
        available: !!monitor,
        paused: !(monitor?.enabled ?? deadline?.enabled ?? true),
        deadline: deadline?.quotaGraceEndsAt,
        state: data.retainedMonitorIds.includes(id)
          ? 'retained'
          : restricted
            ? 'restricted'
            : deadline
              ? 'graceRow'
              : '',
        restricted,
      }
    })
    .filter(
      (row) =>
        !query ||
        `${row.name} ${row.projectName}`.toLocaleLowerCase().includes(query),
    )
})
function toggle(id: string, checked: boolean) {
  if (saving.value || loading.value) return
  if (!checked) selected.value = selected.value.filter((value) => value !== id)
  else if (
    capacity.value &&
    selected.value.length < capacity.value.limit &&
    !selected.value.includes(id)
  )
    selected.value = [...selected.value, id]
}
async function submit(reset = false) {
  if (reset) selected.value = []
  if (await save()) MessagePlugin.success(t('monitorCapacity.saved'))
}
defineExpose({ load, dirty, saving })
</script>

<template>
  <t-card
    v-if="canManage"
    id="monitor-capacity"
    class="capacity"
    :title="t('monitorCapacity.title')"
  >
    <template #actions>
      <t-tag
        v-if="capacity"
        :theme="
          capacity.status === 'LIMITED'
            ? 'danger'
            : capacity.status === 'GRACE'
              ? 'warning'
              : 'success'
        "
        variant="light"
      >
        {{ t(`monitorCapacity.${capacity.status}`) }}
      </t-tag>
    </template>
    <div
      class="capacity__content"
      :aria-busy="loading || saving"
    >
      <t-alert
        v-if="error"
        theme="error"
        :message="error"
      />
      <t-loading
        v-if="loading && !capacity"
        :text="t('common.loading')"
      />
      <template v-if="capacity">
        <p class="capacity__summary">
          {{ t('monitorCapacity.summary', capacity) }}
        </p>
        <t-alert
          :theme="capacity.status === 'LIMITED' ? 'warning' : 'info'"
          :message="
            t(
              `monitorCapacity.${capacity.status === 'GRACE' ? 'grace' : capacity.status === 'LIMITED' ? 'limited' : 'within'}`,
            )
          "
        />
        <p v-if="capacity.graceEndsAt">
          {{
            t('monitorCapacity.deadline', { time: time(capacity.graceEndsAt) })
          }}
        </p>
        <template v-if="capacity.cycleId">
          <p class="capacity__hint">
            {{ t('monitorCapacity.rules', { limit: capacity.limit }) }}
          </p>
          <t-alert
            v-if="monitorsError"
            theme="error"
            :message="monitorsError"
          />
          <div class="capacity__toolbar">
            <t-input
              v-model="search"
              clearable
              :placeholder="t('monitorCapacity.search')"
              :aria-label="t('monitorCapacity.search')"
            />
            <span>{{
              t('monitorCapacity.selected', {
                count: selected.length,
                limit: capacity.limit,
              })
            }}</span>
          </div>
          <div class="capacity__table-wrap">
            <table class="capacity__table">
              <thead>
                <tr>
                  <th>{{ t('monitorCapacity.priority') }}</th>
                  <th>{{ t('monitorCapacity.monitor') }}</th>
                  <th>{{ t('monitorCapacity.actual') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in rows"
                  :key="row.id"
                >
                  <td>
                    <t-checkbox
                      :checked="selected.includes(row.id)"
                      :aria-label="`${t('monitorCapacity.priority')} ${row.name}`"
                      :disabled="
                        saving ||
                        loading ||
                        !!monitorsError ||
                        (!selected.includes(row.id) &&
                          (!row.available || selected.length >= capacity.limit))
                      "
                      @change="(checked: boolean) => toggle(row.id, checked)"
                    />
                  </td>
                  <td>
                    <span>{{ row.name }}</span
                    ><small>{{
                      row.projectName || t('monitorCapacity.unavailableHint')
                    }}</small>
                  </td>
                  <td>
                    <div class="capacity__tags">
                      <t-tag
                        v-if="row.state"
                        :theme="
                          row.state === 'retained'
                            ? 'primary'
                            : row.restricted
                              ? 'danger'
                              : 'warning'
                        "
                        variant="light"
                        size="small"
                        >{{ t(`monitorCapacity.${row.state}`) }}</t-tag
                      >
                      <t-tag
                        v-if="row.paused"
                        variant="light"
                        size="small"
                        >{{ t('monitorCapacity.paused') }}</t-tag
                      >
                    </div>
                    <small v-if="row.deadline">{{ time(row.deadline) }}</small>
                  </td>
                </tr>
                <tr v-if="!rows.length">
                  <td colspan="3">{{ t('monitorCapacity.empty') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="capacity__hint">{{ t('monitorCapacity.recovery') }}</p>
        </template>
      </template>
      <div class="capacity__actions">
        <template v-if="capacity?.cycleId">
          <t-popconfirm
            :content="t('monitorCapacity.confirm')"
            @confirm="submit()"
            ><t-button
              :loading="saving"
              :disabled="
                !dirty ||
                loading ||
                !!monitorsError ||
                selected.length > capacity.limit
              "
              >{{ t('monitorCapacity.save') }}</t-button
            ></t-popconfirm
          >
          <t-popconfirm
            :content="t('monitorCapacity.resetConfirm')"
            @confirm="submit(true)"
            ><t-button
              variant="outline"
              :disabled="
                saving ||
                loading ||
                !!monitorsError ||
                (!selected.length && !capacity.selectedMonitorIds.length)
              "
              >{{ t('monitorCapacity.reset') }}</t-button
            ></t-popconfirm
          >
        </template>
        <t-popconfirm
          v-if="dirty"
          :content="t('monitorCapacity.refreshConfirm')"
          @confirm="load"
          ><t-button
            variant="text"
            :disabled="saving || loading"
            >{{ t('monitorCapacity.refresh') }}</t-button
          ></t-popconfirm
        >
        <t-button
          v-else
          variant="text"
          :loading="loading"
          :disabled="saving"
          @click="load"
          >{{ t('monitorCapacity.refresh') }}</t-button
        >
        <t-button
          v-if="capacity?.overLimit"
          variant="text"
          @click="emit('upgrade')"
          >{{ t('monitorCapacity.upgrade') }}</t-button
        >
      </div>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.capacity {
  scroll-margin-top: 24px;
  &__content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  p {
    margin: 0;
  }
  &__summary {
    font-size: 16px;
    font-weight: 600;
  }
  &__hint,
  small {
    color: @beacon-text-secondary;
    line-height: 1.7;
  }
  &__toolbar,
  &__actions,
  &__tags {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  &__toolbar {
    justify-content: space-between;
    .t-input__wrap {
      max-width: 360px;
    }
  }
  &__table-wrap {
    max-height: 440px;
    overflow: auto;
    border: 1px solid @beacon-border;
  }
  &__table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    th {
      position: sticky;
      top: 0;
      background: @beacon-bg-container;
      z-index: 1;
    }
    th,
    td {
      padding: 12px 16px;
      border-bottom: 1px solid @beacon-border;
    }
    th:first-child,
    td:first-child {
      width: 88px;
    }
    small {
      display: block;
      margin-top: 4px;
      overflow-wrap: anywhere;
    }
  }
}
</style>
