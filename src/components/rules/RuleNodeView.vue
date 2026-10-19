<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RuleNodeText } from '@/utils/rule-presenter'

/** 只读规则树的递归渲染：逻辑组显示「组 N：全部满足 / 任一满足」，叶子显示规则文案 */
defineOptions({ name: 'RuleNodeView' })

const props = defineProps<{ node: RuleNodeText; depth: number }>()
const { t } = useI18n()
const join = computed(() =>
  props.node.kind === 'logic' && props.node.operator === 'and'
    ? t('ruleGroup.joinAndShort')
    : t('ruleGroup.joinOrShort'),
)
</script>

<template>
  <div
    v-if="node.kind === 'logic'"
    class="rule-view__group"
  >
    <p class="rule-view__group-title">
      {{ t('ruleGroup.groupTitle', { index: depth, label: node.label }) }}
    </p>
    <div class="rule-view__children">
      <template
        v-for="(child, index) in node.children"
        :key="child.id"
      >
        <span
          v-if="index"
          class="rule-view__join"
          >{{ join }}</span
        >
        <RuleNodeView
          :node="child"
          :depth="depth + 1"
        />
      </template>
    </div>
  </div>
  <p
    v-else
    class="rule-view__condition"
  >
    <span
      class="rule-view__bullet"
      aria-hidden="true"
      >•</span
    ><span>{{ node.text }}</span>
  </p>
</template>

<style scoped lang="less">
.rule-view {
  &__group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__group-title {
    margin: 0;
    color: @beacon-success;
    font-weight: @beacon-font-weight-medium;
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

  &__condition {
    display: flex;
    gap: 8px;
    margin: 0;
    color: @beacon-text-primary;

    span:last-child {
      overflow-wrap: anywhere;
    }
  }

  &__bullet {
    color: @beacon-text-tertiary;
  }
}
</style>
