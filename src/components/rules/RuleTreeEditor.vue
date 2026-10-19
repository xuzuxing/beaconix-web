<script setup lang="ts">
import { computed, provide, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConditionNode, RuleMeta, RuleNode } from '@/api/types/rule'
import { MAX_RULE_DEPTH } from '@/config/rules'
import {
  countRuleNodes,
  isLogicNode,
  validateRuleTree,
  type RuleTranslator,
  type RuleTreeIssue,
} from '@/utils/rule-presenter'
import {
  appendRuleChild,
  createConditionNode,
  createLogicNode,
  removeRuleNode,
  updateConditionNode,
  updateLogicOperator,
} from '@/utils/rule-tree-ops'
import RuleConditionRow from './RuleConditionRow.vue'
import RuleLogicGroup from './RuleLogicGroup.vue'
import { RULE_EDITOR_KEY } from './rule-editor'

/**
 * 异常条件规则编辑器（参考图 2）：根逻辑组 + 可递归嵌套的 AND/OR 逻辑组 + 规则行。
 * 子组件只按节点 id 回调，编辑统一在这里对整棵树做不可变更新后回写 model。
 * 字段 / 操作符 / 取值范围来自后端 `GET /rule-meta`，模板由页面注入。
 */
defineOptions({ name: 'RuleTreeEditor' })

const props = defineProps<{ meta: RuleMeta | null }>()
const tree = defineModel<RuleNode>({ required: true })
const { t } = useI18n()
const tr: RuleTranslator = (key, params) => t(key, params ?? {})

const rootLogic = computed(() => (isLogicNode(tree.value) ? tree.value : null))
const counts = computed(() => countRuleNodes(tree.value))
const issues = computed<RuleTreeIssue[]>(() =>
  validateRuleTree(tree.value, props.meta),
)
const logicOptions = computed(() => [
  { label: tr('ruleGroup.logic.and'), value: 'and' },
  { label: tr('ruleGroup.logic.or'), value: 'or' },
])
const ruleIndex = (id: string) =>
  (rootLogic.value?.children ?? [])
    .filter((child) => child.type === 'condition')
    .findIndex((child) => child.id === id) + 1

function requireMeta(): RuleMeta {
  if (!props.meta) throw new Error('规则元数据尚未加载，无法新增条件')
  return props.meta
}
function addCondition(parentId: string) {
  tree.value = appendRuleChild(
    tree.value,
    parentId,
    createConditionNode(requireMeta()),
  )
}
function addLogicGroup(parentId: string) {
  tree.value = appendRuleChild(tree.value, parentId, createLogicNode())
}
function setRootOperator(operator: 'and' | 'or') {
  if (rootLogic.value)
    tree.value = updateLogicOperator(tree.value, rootLogic.value.id, operator)
}

provide(RULE_EDITOR_KEY, {
  meta: toRef(props, 'meta'),
  t: tr,
  updateCondition: (id, patch) => {
    tree.value = updateConditionNode(tree.value, id, patch)
  },
  setLogicOperator: (id, operator) => {
    tree.value = updateLogicOperator(tree.value, id, operator)
  },
  removeNode: (id) => {
    tree.value = removeRuleNode(tree.value, id)
  },
  addCondition,
  addLogicGroup,
})
</script>

<template>
  <div class="rule-editor">
    <t-alert
      theme="warning"
      :message="t('ruleGroup.editorHint')"
    />
    <div class="rule-editor__head">
      <div>
        <span class="rule-editor__title">{{ t('ruleGroup.rootGroup') }}</span>
        <small>{{ t('ruleGroup.rootHint') }}</small>
      </div>
      <div class="rule-editor__actions">
        <span class="rule-editor__count">{{
          t('ruleGroup.rulesCount', {
            rules: counts.conditions,
            groups: counts.logics,
          })
        }}</span>
        <t-select
          v-if="rootLogic"
          :value="rootLogic.operator"
          :options="logicOptions"
          :aria-label="t('ruleGroup.rootOperator')"
          @change="(value: string) => setRootOperator(value as 'and' | 'or')"
        />
      </div>
    </div>
    <p
      v-if="!meta"
      class="rule-editor__empty"
    >
      {{ t('ruleGroup.metaLoading') }}
    </p>
    <div
      v-else
      class="rule-editor__body"
    >
      <template v-if="rootLogic">
        <template
          v-for="child in rootLogic.children"
          :key="child.id"
        >
          <RuleLogicGroup
            v-if="child.type === 'logic'"
            :node="child"
            :depth="1"
          />
          <RuleConditionRow
            v-else
            :node="child"
            :index="ruleIndex(child.id)"
            removable
          />
        </template>
        <p
          v-if="!rootLogic.children.length"
          class="rule-editor__empty"
        >
          {{ t('ruleGroup.emptyGroup') }}
        </p>
      </template>
      <RuleConditionRow
        v-else
        :node="tree as ConditionNode"
      />
    </div>
    <div class="rule-editor__footer">
      <t-button
        size="small"
        variant="outline"
        :disabled="!meta || !rootLogic"
        @click="rootLogic && addCondition(rootLogic.id)"
        >{{ t('ruleGroup.addCondition') }}</t-button
      >
      <t-button
        size="small"
        :disabled="!meta || !rootLogic || MAX_RULE_DEPTH <= 1"
        @click="rootLogic && addLogicGroup(rootLogic.id)"
        >{{ t('ruleGroup.addLogicGroup') }}</t-button
      >
    </div>
    <ul
      v-if="issues.length"
      class="rule-editor__issues"
    >
      <li
        v-for="(issue, index) in issues"
        :key="`${issue.id}-${issue.messageKey}-${index}`"
      >
        {{ t(issue.messageKey, issue.params ?? {}) }}
      </li>
    </ul>
  </div>
</template>

<style scoped lang="less">
.rule-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;

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

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;

    :deep(.t-select__wrap) {
      width: 200px;
    }
  }

  &__count {
    color: @beacon-text-secondary;
    font-size: 12px;
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

  &__issues {
    margin: 0;
    padding-left: 18px;
    color: @beacon-error;
    font-size: 12px;
  }
}

@media (max-width: 720px) {
  .rule-editor__actions {
    width: 100%;

    :deep(.t-select__wrap) {
      width: 100%;
    }
  }
}
</style>
