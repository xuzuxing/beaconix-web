<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RuleGroup } from '@/api/types/rule'
import { fieldLabelKey } from '@/config/rules'
import { formatMonitorTime } from '@/utils/monitor-presenter'
import { countRuleNodes } from '@/utils/rule-presenter'
import RuleTreeView from './RuleTreeView.vue'

/** 规则组详情抽屉：基本信息 + 只读规则树（参考图 1 的展示形态） */
defineOptions({ name: 'RuleGroupDetailDrawer' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ group: RuleGroup | null; editable?: boolean }>()
const emit = defineEmits<{ edit: [group: RuleGroup] }>()
const { t, locale } = useI18n()

const counts = computed(() =>
  props.group?.tree ? countRuleNodes(props.group.tree) : { conditions: 0, logics: 0 },
)
const fields = computed(() =>
  (props.group?.fieldsUsed ?? []).map((field) => {
    const key = fieldLabelKey(field)
    return key ? t(key) : field
  }),
)
</script>

<template>
  <t-drawer
    v-model:visible="visible"
    size="min(600px, 100vw)"
    :header="group?.name ?? t('ruleGroup.detailTitle')"
    :footer="false"
  >
    <div v-if="group" class="rule-group-detail">
      <dl class="rule-group-detail__info">
        <div>
          <dt>{{ t('ruleGroup.scopeLabel') }}</dt>
          <dd>{{ group.projectId ? t('ruleGroup.scope.project') : t('ruleGroup.scope.org') }}</dd>
        </div>
        <div>
          <dt>{{ t('ruleGroup.stateLabel') }}</dt>
          <dd>{{ t(group.enabled ? 'ruleGroup.state.on' : 'ruleGroup.state.off') }}</dd>
        </div>
        <div>
          <dt>{{ t('ruleGroup.fieldsLabel') }}</dt>
          <dd>{{ fields.join(' · ') || '-' }}</dd>
        </div>
        <div v-if="group.tree">
          <dt>{{ t('ruleGroup.rulesLabel') }}</dt>
          <dd>
            {{ t('ruleGroup.rulesCount', { rules: counts.conditions, groups: counts.logics }) }}
          </dd>
        </div>
        <div>
          <dt>{{ t('ruleGroup.createdAt') }}</dt>
          <dd>{{ formatMonitorTime(group.createdAt, locale) }}</dd>
        </div>
        <div>
          <dt>{{ t('ruleGroup.updatedAt') }}</dt>
          <dd>{{ formatMonitorTime(group.updatedAt, locale) }}</dd>
        </div>
      </dl>
      <p v-if="group.description" class="rule-group-detail__desc">{{ group.description }}</p>
      <section v-if="group.tree" class="rule-group-detail__tree">
        <div class="rule-group-detail__tree-head">
          <h4>{{ t('ruleGroup.treeTitle') }}</h4>
          <t-button v-if="editable" size="small" variant="outline" @click="emit('edit', group)">{{
            t('ruleGroup.edit')
          }}</t-button>
        </div>
        <RuleTreeView v-if="group.tree" :tree="group.tree" />
      </section>
    </div>
  </t-drawer>
</template>

<style scoped lang="less">
.rule-group-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__info {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 24px;
    margin: 0;

    dt {
      margin-bottom: 6px;
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  &__desc {
    margin: 0;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__tree {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid @beacon-border;
  }

  &__tree-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h4 {
      margin: 0;
      font-size: @beacon-font-size-section;
      font-weight: @beacon-font-weight-medium;
    }
  }
}
</style>
