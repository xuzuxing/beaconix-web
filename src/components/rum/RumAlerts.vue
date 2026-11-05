<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RumAlertInput, RumAlertRule } from '@/api/types/rum'
import { useRumAlerts } from '@/composables/useRumAlerts'
import RumAlertIncidents from './RumAlertIncidents.vue'
import RumAlertRuleForm from './RumAlertRuleForm.vue'
import RumAlertRuleList from './RumAlertRuleList.vue'
import RumState from './RumState.vue'

const { t } = useI18n()
const alerts = useRumAlerts()
const formVisible = shallowRef(false)
const editingRule = shallowRef<RumAlertRule | null>(null)

watch(
  [alerts.projectId, alerts.appId],
  () => {
    formVisible.value = false
    editingRule.value = null
  },
  { flush: 'sync' },
)

function openForm(rule: RumAlertRule | null = null) {
  editingRule.value = rule
  formVisible.value = true
}

function closeForm() {
  formVisible.value = false
  editingRule.value = null
}

async function save(input: RumAlertInput) {
  if (await alerts.saveRule(editingRule.value?.id ?? '', input)) closeForm()
}
</script>

<template>
  <div class="alerts-page">
    <t-card>
      <div class="alerts-page__head">
        <h2>{{ t('rum.alerts') }}</h2>
        <t-button
          v-if="alerts.canManage.value"
          @click="openForm()"
        >
          {{ t('rum.create') }}
        </t-button>
      </div>
      <RumState
        :loading="alerts.rules.loading.value"
        :error="alerts.rules.error.value"
        @retry="alerts.rules.reload"
      >
        <RumAlertRuleList
          :rules="alerts.rules.data.value ?? []"
          :can-manage="alerts.canManage.value"
          :busy="alerts.submitting.value"
          @edit="openForm"
          @remove="alerts.removeRule($event.id)"
        />
      </RumState>
    </t-card>

    <RumState
      :loading="alerts.incidents.loading.value"
      :error="alerts.incidents.error.value"
      @retry="alerts.incidents.reload"
    >
      <RumAlertIncidents
        v-if="alerts.incidents.data.value"
        :data="alerts.incidents.data.value"
        :page="alerts.incidentPage.value"
        :status="alerts.incidentStatus.value"
        @update-page="alerts.setIncidentPage"
        @update-status="alerts.setIncidentStatus"
      />
    </RumState>

    <RumAlertRuleForm
      :visible="formVisible"
      :rule="editingRule"
      :channels="alerts.channels.data.value ?? []"
      :channels-loading="alerts.channels.loading.value"
      :channels-error="alerts.channels.error.value"
      :saving="alerts.submitting.value"
      @cancel="closeForm"
      @save="save"
      @retry-channels="alerts.channels.reload"
    />
  </div>
</template>

<style scoped>
.alerts-page {
  display: grid;
  gap: 28px;
}

.alerts-page__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.alerts-page__head h2 {
  margin: 0;
}
</style>
