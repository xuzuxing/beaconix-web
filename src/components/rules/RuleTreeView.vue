<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RuleNode } from '@/api/types/rule'
import { countRuleNodes, describeRuleTree, summarizeRuleTree, type RuleTranslator } from '@/utils/rule-presenter'
import RuleNodeView from './RuleNodeView.vue'

/**
 * 只读规则树（参考图 1）：根逻辑组的判定说明 + 可递归嵌套的组与规则。
 * `compact` 用于列表 / 卡片摘要，渲染一行「N 条规则 / M 个逻辑组 + 规则摘要」。
 */
defineOptions({ name: 'RuleTreeView' })

const props = defineProps<{ tree: RuleNode; compact?: boolean }>()
const { t } = useI18n()
const tr: RuleTranslator = (key, params) => t(key, params ?? {})

const text = computed(() => describeRuleTree(props.tree, tr))
const counts = computed(() => countRuleNodes(props.tree))
const summary = computed(() => summarizeRuleTree(props.tree, tr))
const rootHint = computed(() =>
  props.tree.type === 'logic' && props.tree.operator === 'and'
    ? tr('ruleGroup.viewRootHint.and')
    : tr('ruleGroup.viewRootHint.or'),
)
</script>

<template>
  <p v-if="compact" class="rule-view__summary" :title="summary">
    <span class="rule-view__count">{{
      t('ruleGroup.rulesCount', { rules: counts.conditions, groups: counts.logics })
    }}</span>
    <span class="rule-view__summary-text">{{ summary }}</span>
  </p>
  <div v-else class="rule-view">
    <p class="rule-view__root-hint">{{ rootHint }}</p>
    <template v-if="tree.type === 'logic'">
      <div class="rule-view__children">
        <template v-for="(child, index) in text.kind === 'logic' ? text.children : []" :key="child.id">
          <span v-if="index" class="rule-view__join">{{
            tree.operator === 'and' ? t('ruleGroup.joinAndShort') : t('ruleGroup.joinOrShort')
          }}</span>
          <RuleNodeView :node="child" :depth="1" />
        </template>
      </div>
      <p v-if="!tree.children.length" class="rule-view__empty">{{ t('ruleGroup.emptyGroup') }}</p>
    </template>
    <RuleNodeView v-else :node="text" :depth="1" />
  </div>
</template>

<style scoped lang="less">
.rule-view {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__root-hint {
    margin: 0;
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__children {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 12px;
    border-left: 2px solid @beacon-border;
  }

  &__join {
    align-self: flex-start;
    margin-left: 10px;
    padding: 0 8px;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
    background: @beacon-bg-page;
    color: @beacon-text-secondary;
    font-size: 12px;
    line-height: 18px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }

  &__summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }

  &__count {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__summary-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: @beacon-text-primary;
  }
}
</style>
