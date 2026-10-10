<script setup lang="ts">
import { computed, inject } from 'vue'
import type { ConditionNode, RuleField, RuleOperator } from '@/api/types/rule'
import {
  FIELD_LABEL_KEYS,
  FIELD_VALUE_TYPES,
  OPERATOR_LABEL_KEYS,
  STATUS_CLASS_LABEL_KEYS,
} from '@/config/rules'
import { normalizeMultiValues } from '@/utils/rule-presenter'
import { conditionPatchFor } from '@/utils/rule-tree-ops'
import { RULE_EDITOR_KEY, type RuleEditorContext } from './rule-editor'

/** 一条规则：指标 / 运算符 / 阈值（对齐参考图的规则行） */
defineOptions({ name: 'RuleConditionRow' })

const props = defineProps<{ node: ConditionNode; index?: number; removable?: boolean }>()
const injected = inject(RULE_EDITOR_KEY)
if (!injected) throw new Error('RuleConditionRow 必须渲染在 RuleTreeEditor 内')
const editor: RuleEditorContext = injected
const t = editor.t
const meta = editor.meta

const fieldMeta = computed(() => meta.value?.meta[props.node.field])
const valueType = computed(() => FIELD_VALUE_TYPES[props.node.field] ?? 'string')
const isMulti = computed(() => ['in', 'not_in', 'statusClass'].includes(props.node.operator))
const isStatusClass = computed(() => props.node.operator === 'statusClass')

const fieldOptions = computed(() =>
  (meta.value?.fields ?? []).map((field) => ({
    label: FIELD_LABEL_KEYS[field] ? t(FIELD_LABEL_KEYS[field]) : field,
    value: field,
  })),
)
const operatorOptions = computed(() =>
  (fieldMeta.value?.operators ?? []).map((operator) => ({
    label: OPERATOR_LABEL_KEYS[operator] ? t(OPERATOR_LABEL_KEYS[operator]) : operator,
    value: operator,
  })),
)
const statusClassOptions = computed(() =>
  (meta.value?.statusClassValues ?? []).map((value) => ({
    label: STATUS_CLASS_LABEL_KEYS[value] ? t(STATUS_CLASS_LABEL_KEYS[value]) : String(value),
    value: String(value),
  })),
)
const booleanOptions = computed(() => [
  { label: t('ruleGroup.value.true'), value: true },
  { label: t('ruleGroup.value.false'), value: false },
])

// 阈值按字段语义与操作符切换控件：多值 → 标签多选，布尔 → 成功/失败，数字 → 数字框，文本 → 输入框
const multiValue = computed({
  get: () => normalizeMultiValues(props.node.value),
  set: (value: string[]) => editor.updateCondition(props.node.id, { value }),
})
const booleanValue = computed({
  get: () => props.node.value === true || String(props.node.value) === 'true',
  set: (value: boolean) => editor.updateCondition(props.node.id, { value }),
})
const numberValue = computed({
  get: () => {
    const value = Number(props.node.value)
    return Number.isFinite(value) ? value : undefined
  },
  set: (value: number | undefined) =>
    editor.updateCondition(props.node.id, {
      value: value ?? fieldMeta.value?.default.value ?? 0,
    }),
})
const textValue = computed({
  get: () => String(props.node.value ?? ''),
  set: (value: string) => editor.updateCondition(props.node.id, { value }),
})

function changeField(field: RuleField) {
  const current = meta.value
  if (current)
    editor.updateCondition(props.node.id, conditionPatchFor(current, props.node, { field }))
}
function changeOperator(operator: RuleOperator) {
  const current = meta.value
  if (current)
    editor.updateCondition(props.node.id, conditionPatchFor(current, props.node, { operator }))
}
</script>

<template>
  <div class="rule-row">
    <div class="rule-row__head">
      <span class="rule-row__title">{{
        index === undefined ? t('ruleGroup.condition') : t('ruleGroup.conditionTitle', { index })
      }}</span>
      <t-button
        v-if="removable"
        size="small"
        variant="outline"
        theme="danger"
        @click="editor.removeNode(node.id)"
        >{{ t('ruleGroup.remove') }}</t-button
      >
    </div>
    <div class="rule-row__grid">
      <label class="rule-row__cell">
        <span>{{ t('ruleGroup.fieldLabel') }}</span>
        <t-select
          :value="node.field"
          :options="fieldOptions"
          @change="(value: string) => changeField(value as RuleField)"
        />
      </label>
      <label class="rule-row__cell">
        <span>{{ t('ruleGroup.operatorLabel') }}</span>
        <t-select
          :value="node.operator"
          :options="operatorOptions"
          @change="(value: string) => changeOperator(value as RuleOperator)"
        />
      </label>
      <label class="rule-row__cell">
        <span>{{ t('ruleGroup.thresholdLabel') }}</span>
        <t-select
          v-if="isStatusClass"
          v-model="multiValue"
          multiple
          clearable
          :options="statusClassOptions"
        />
        <t-select
          v-else-if="isMulti"
          v-model="multiValue"
          multiple
          filterable
          creatable
          clearable
          :placeholder="t('ruleGroup.thresholdMultiPlaceholder')"
        />
        <t-select
          v-else-if="valueType === 'boolean'"
          v-model="booleanValue"
          :options="booleanOptions"
        />
        <t-input-number
          v-else-if="valueType === 'number'"
          v-model="numberValue"
          :min="fieldMeta?.constraints?.min"
          :max="fieldMeta?.constraints?.max"
          :step="fieldMeta?.constraints?.integer === false ? 0.1 : 1"
        />
        <t-input v-else v-model="textValue" :maxlength="fieldMeta?.constraints?.maxLength ?? 512" />
      </label>
    </div>
  </div>
</template>

<style scoped lang="less">
.rule-row {
  padding: 12px 16px 16px;
  background: @beacon-bg-container;
  border: 1px solid @beacon-border;
  border-radius: @beacon-radius-m;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__title {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(150px, 1fr) minmax(130px, 1fr) minmax(180px, 1.3fr);
    gap: 12px 16px;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;

    > span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }
}

@media (max-width: 720px) {
  .rule-row__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
