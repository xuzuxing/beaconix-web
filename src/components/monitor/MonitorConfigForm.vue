<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HttpAssertionOperator, MonitorConfig, MonitorType } from '@/api/types'
import { monitorConfigPayload, parseAssertionValue } from '@/utils/monitor-config'

/**
 * 协议配置表单：按监控协议渲染各自的 config 字段（对应后端 CreateMonitorDto.config）。
 *
 * 表单值内聚在这里，父组件通过模板 ref 调用 buildConfig() / validate() / isDirty()：
 * - buildConfig() 把字段整理成后端接受的 config（空的可选字段不提交）
 * - isDirty() 用于「编辑时未改动就不提交 config，以保留已保存的凭据」
 */
const props = defineProps<{ type: MonitorType; config: Record<string, unknown> }>()
const { t } = useI18n()

/** 一行 JSON 指针断言；value 以字符串承载，提交时按字面量解析 */
interface AssertionRow {
  path: string
  operator: HttpAssertionOperator
  value: string
}

const fields = reactive({
  keyword: '',
  keywordMode: 'contains' as 'contains' | 'notContains',
  maxBodyBytes: null as number | null,
  jsonAssertions: [] as AssertionRow[],
  recordType: 'A' as 'A' | 'AAAA' | 'CNAME',
  expectedValues: [] as string[],
  username: '',
  password: '',
  database: '',
  db: 0,
  authSource: 'admin',
  tls: true,
  tlsCa: '',
  containerId: '',
  token: '',
  tlsCert: '',
  tlsKey: '',
  service: '',
})

const dirty = ref(false)
/** 初始化表单时抑制脏标记，避免打开弹窗就被判定成「改过配置」 */
let restoring = false

const text = (value: unknown) => (typeof value === 'string' ? value : '')

function restore(draft: Record<string, unknown>) {
  restoring = true
  const assertions = Array.isArray(draft.jsonAssertions)
    ? (draft.jsonAssertions as Array<Record<string, unknown>>)
    : []
  Object.assign(fields, {
    keyword: text(draft.keyword),
    keywordMode: draft.keywordMode === 'notContains' ? 'notContains' : 'contains',
    maxBodyBytes: typeof draft.maxBodyBytes === 'number' ? draft.maxBodyBytes : null,
    jsonAssertions: assertions.map((row) => ({
      path: text(row.path),
      operator:
        row.operator === 'notExists' || row.operator === 'eq' || row.operator === 'neq'
          ? row.operator
          : 'exists',
      value: row.value === null || row.value === undefined ? '' : String(row.value),
    })),
    recordType: draft.recordType === 'AAAA' || draft.recordType === 'CNAME' ? draft.recordType : 'A',
    expectedValues: Array.isArray(draft.expectedValues) ? draft.expectedValues.map(String) : [],
    username: text(draft.username),
    password: text(draft.password),
    database: text(draft.database),
    db: typeof draft.db === 'number' ? draft.db : 0,
    authSource: text(draft.authSource) || 'admin',
    tls: draft.tls !== false,
    tlsCa: text(draft.tlsCa),
    containerId: text(draft.containerId),
    token: text(draft.token),
    tlsCert: text(draft.tlsCert),
    tlsKey: text(draft.tlsKey),
    service: text(draft.service),
  })
  dirty.value = false
  restoring = false
}

watch(
  () => [props.type, props.config] as const,
  () => restore(props.config ?? {}),
  { immediate: true, deep: true },
)
// flush: 'sync' 才能区分「初始化覆盖」与「用户改动」
watch(
  fields,
  () => {
    if (!restoring) dirty.value = true
  },
  { deep: true, flush: 'sync' },
)

const operatorOptions = computed(() => [
  { label: t('workspace.monitor.config.operator.exists'), value: 'exists' },
  { label: t('workspace.monitor.config.operator.notExists'), value: 'notExists' },
  { label: t('workspace.monitor.config.operator.eq'), value: 'eq' },
  { label: t('workspace.monitor.config.operator.neq'), value: 'neq' },
])
const recordTypeOptions = computed(() =>
  (['A', 'AAAA', 'CNAME'] as const).map((value) => ({ label: value, value })),
)
const hasBodyAssertion = computed(
  () => Boolean(fields.keyword.trim()) || fields.jsonAssertions.length > 0,
)

function addAssertion() {
  if (fields.jsonAssertions.length >= 10) return
  fields.jsonAssertions.push({ path: '', operator: 'exists', value: '' })
}
function removeAssertion(index: number) {
  fields.jsonAssertions.splice(index, 1)
}

function buildConfig(): MonitorConfig {
  return monitorConfigPayload(props.type, {
    ...fields,
    jsonAssertions: fields.jsonAssertions.map((row) => ({
      path: row.path,
      operator: row.operator,
      ...(row.operator === 'eq' || row.operator === 'neq'
        ? { value: parseAssertionValue(row.value) }
        : {}),
    })),
  })
}

/** 返回错误文案（空串表示通过）；对应后端 config 的 required 约束 */
function validate(): string {
  if ((props.type === 'MYSQL' || props.type === 'POSTGRESQL') && (!fields.username.trim() || !fields.database.trim()))
    return t('workspace.monitor.config.required')
  if (props.type === 'DOCKER' && !fields.containerId.trim())
    return t('workspace.monitor.config.required')
  if (
    props.type === 'HTTP' &&
    fields.jsonAssertions.some(
      (row) => (row.operator === 'eq' || row.operator === 'neq') && !row.value.trim(),
    )
  )
    return t('workspace.monitor.config.assertionValueRequired')
  return ''
}

defineExpose({ buildConfig, validate, isDirty: () => dirty.value })
</script>

<template>
  <p v-if="type === 'TCP' || type === 'PING'" class="config-empty">
    {{ t('workspace.monitor.config.none') }}
  </p>

  <template v-else-if="type === 'HTTP'">
    <t-form-item :label="t('workspace.monitor.config.keyword')">
      <t-input
        v-model="fields.keyword"
        :maxlength="1024"
        :placeholder="t('workspace.monitor.config.keywordPlaceholder')"
      />
    </t-form-item>
    <t-form-item v-if="fields.keyword.trim()" :label="t('workspace.monitor.config.keywordMode')">
      <t-radio-group v-model="fields.keywordMode" variant="default-filled">
        <t-radio-button value="contains">{{
          t('workspace.monitor.config.modeContains')
        }}</t-radio-button>
        <t-radio-button value="notContains">{{
          t('workspace.monitor.config.modeNotContains')
        }}</t-radio-button>
      </t-radio-group>
    </t-form-item>

    <div class="config-list">
      <div class="config-list__head">
        <div>
          <span class="config-list__title">{{ t('workspace.monitor.config.jsonAssertions') }}</span>
          <small>{{ t('workspace.monitor.config.jsonAssertionsHint') }}</small>
        </div>
        <t-button
          size="small"
          variant="outline"
          :disabled="fields.jsonAssertions.length >= 10"
          @click="addAssertion"
          >{{ t('workspace.monitor.config.addAssertion') }}</t-button
        >
      </div>
      <p v-if="!fields.jsonAssertions.length" class="config-list__empty">
        {{ t('workspace.monitor.config.jsonAssertionsEmpty') }}
      </p>
      <div v-for="(row, index) in fields.jsonAssertions" :key="index" class="config-list__row">
        <t-input
          v-model="row.path"
          :maxlength="256"
          :placeholder="t('workspace.monitor.config.jsonPathPlaceholder')"
        />
        <t-select v-model="row.operator" :options="operatorOptions" />
        <t-input
          v-if="row.operator === 'eq' || row.operator === 'neq'"
          v-model="row.value"
          :maxlength="1024"
          :placeholder="t('workspace.monitor.config.jsonValuePlaceholder')"
        />
        <t-button size="small" variant="text" theme="danger" @click="removeAssertion(index)">{{
          t('common.delete')
        }}</t-button>
      </div>
    </div>

    <t-form-item v-if="hasBodyAssertion" :label="t('workspace.monitor.config.maxBodyBytes')">
      <t-input-number v-model="fields.maxBodyBytes" :min="1024" :max="1048576" :step="1024" />
    </t-form-item>
  </template>

  <template v-else-if="type === 'DNS'">
    <t-form-item :label="t('workspace.monitor.config.recordType')">
      <t-select v-model="fields.recordType" :options="recordTypeOptions" />
    </t-form-item>
    <t-form-item :label="t('workspace.monitor.config.expectedValues')">
      <t-tag-input
        v-model="fields.expectedValues"
        :placeholder="t('workspace.monitor.config.expectedValuesPlaceholder')"
        clearable
      />
    </t-form-item>
  </template>

  <template v-else>
    <div class="config-grid">
      <template v-if="type === 'MYSQL' || type === 'POSTGRESQL'">
        <t-form-item :label="t('workspace.monitor.config.username')">
          <t-input v-model="fields.username" :maxlength="256" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.password')">
          <t-input v-model="fields.password" type="password" :maxlength="4096" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.database')">
          <t-input v-model="fields.database" :maxlength="256" />
        </t-form-item>
      </template>

      <template v-else-if="type === 'REDIS'">
        <t-form-item :label="t('workspace.monitor.config.username')">
          <t-input v-model="fields.username" :maxlength="256" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.password')">
          <t-input v-model="fields.password" type="password" :maxlength="4096" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.db')">
          <t-input-number v-model="fields.db" :min="0" :max="15" />
        </t-form-item>
      </template>

      <template v-else-if="type === 'MONGODB'">
        <t-form-item :label="t('workspace.monitor.config.username')">
          <t-input v-model="fields.username" :maxlength="256" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.password')">
          <t-input v-model="fields.password" type="password" :maxlength="4096" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.database')">
          <t-input v-model="fields.database" :maxlength="256" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.authSource')">
          <t-input v-model="fields.authSource" :maxlength="256" />
        </t-form-item>
      </template>

      <template v-else-if="type === 'DOCKER'">
        <t-form-item :label="t('workspace.monitor.config.containerId')">
          <t-input v-model="fields.containerId" :maxlength="128" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.token')">
          <t-input v-model="fields.token" type="password" :maxlength="4096" />
        </t-form-item>
      </template>

      <template v-else-if="type === 'GRPC'">
        <t-form-item :label="t('workspace.monitor.config.service')">
          <t-input v-model="fields.service" :maxlength="256" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.config.token')">
          <t-input v-model="fields.token" type="password" :maxlength="4096" />
        </t-form-item>
      </template>

      <t-form-item v-else-if="type === 'WEBSOCKET'" :label="t('workspace.monitor.config.token')">
        <t-input v-model="fields.token" type="password" :maxlength="4096" />
      </t-form-item>

      <t-form-item v-if="type !== 'WEBSOCKET'" :label="t('workspace.monitor.config.tls')">
        <t-switch v-model="fields.tls" />
      </t-form-item>
    </div>

    <t-form-item :label="t('workspace.monitor.config.tlsCa')">
      <t-textarea v-model="fields.tlsCa" :autosize="{ minRows: 2, maxRows: 6 }" />
    </t-form-item>
    <template v-if="type === 'DOCKER'">
      <t-form-item :label="t('workspace.monitor.config.tlsCert')">
        <t-textarea v-model="fields.tlsCert" :autosize="{ minRows: 2, maxRows: 6 }" />
      </t-form-item>
      <t-form-item :label="t('workspace.monitor.config.tlsKey')">
        <t-textarea v-model="fields.tlsKey" :autosize="{ minRows: 2, maxRows: 6 }" />
      </t-form-item>
    </template>
  </template>
</template>

<style scoped lang="less">
.config-empty {
  margin: 0;
  color: @beacon-text-tertiary;
  font-size: 12px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.config-grid :deep(.t-input-number),
.config-grid :deep(.t-select__wrap) {
  max-width: 100%;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;

    > div {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    small {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }

  &__title {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.4fr) auto;
    gap: 8px;
    align-items: center;
  }
}

@media (max-width: 480px) {
  .config-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .config-list__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
