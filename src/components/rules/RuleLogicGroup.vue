<script setup lang="ts">
import { computed, inject } from 'vue'
import type { LogicNode } from '@/api/types/rule'
import { MAX_RULE_DEPTH } from '@/config/rules'
import RuleConditionRow from './RuleConditionRow.vue'
import { RULE_EDITOR_KEY, type RuleEditorContext } from './rule-editor'

/**
 * 嵌套逻辑组（第 N 层）：组内 AND/OR + 子规则 / 子逻辑组，可继续递归嵌套。
 * 与参考图一致，嵌套逻辑组带「删除逻辑组」与自身的逻辑运算符选择。
 */
defineOptions({ name: 'RuleLogicGroup' })

const props = defineProps<{ node: LogicNode; depth: number }>()
const injected = inject(RULE_EDITOR_KEY)
if (!injected) throw new Error('RuleLogicGroup 必须渲染在 RuleTreeEditor 内')
const editor: RuleEditorContext = injected
const t = editor.t

const logicOptions = computed(() => [
  { label: t('ruleGroup.logic.and'), value: 'and' },
  { label: t('ruleGroup.logic.or'), value: 'or' },
])
/** 超过后端最大嵌套深度后不再提供"添加逻辑组" */
const canNest = computed(() => props.depth < MAX_RULE_DEPTH)
/** 组内编号只数条件节点：嵌套逻辑组不占规则序号 */
const ruleIndex = (id: string) =>
  props.node.children
    .filter((child) => child.type === 'condition')
    .findIndex((child) => child.id === id) + 1
</script>

<template>
  <div class="rule-group">
    <div class="rule-group__head">
      <div class="rule-group__title">
        <span>{{ t('ruleGroup.nestedGroup', { depth }) }}</span>
        <small>{{ t('ruleGroup.groupHint') }}</small>
      </div>
      <div class="rule-group__actions">
        <t-select
          :value="node.operator"
          :options="logicOptions"
          @change="(value: string) => editor.setLogicOperator(node.id, value as 'and' | 'or')"
        />
        <t-button
          size="small"
          variant="outline"
          theme="danger"
          @click="editor.removeNode(node.id)"
          >{{ t('ruleGroup.removeGroup') }}</t-button
        >
      </div>
    </div>
    <div class="rule-group__body">
      <template v-for="child in node.children" :key="child.id">
        <RuleLogicGroup v-if="child.type === 'logic'" :node="child" :depth="depth + 1" />
        <RuleConditionRow v-else :node="child" :index="ruleIndex(child.id)" removable />
      </template>
      <p v-if="!node.children.length" class="rule-group__empty">
        {{ t('ruleGroup.emptyGroup') }}
      </p>
    </div>
    <div class="rule-group__footer">
      <t-button size="small" variant="outline" @click="editor.addCondition(node.id)">{{
        t('ruleGroup.addCondition')
      }}</t-button>
      <t-button v-if="canNest" size="small" @click="editor.addLogicGroup(node.id)">{{
        t('ruleGroup.addLogicGroup')
      }}</t-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.rule-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 16px;
  background: @beacon-bg-page;
  border: 1px solid @beacon-border-strong;
  border-radius: @beacon-radius-m;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;

    small {
      font-weight: 400;
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;

    :deep(.t-select__wrap) {
      width: 180px;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__footer {
    display: flex;
    gap: 8px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
}

@media (max-width: 720px) {
  .rule-group__actions {
    width: 100%;

    :deep(.t-select__wrap) {
      width: 100%;
    }
  }
}
</style>
