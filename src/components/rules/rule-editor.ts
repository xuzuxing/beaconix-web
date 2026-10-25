import type { InjectionKey, Ref } from 'vue'
import type { ConditionNode, RuleMeta } from '@/api/types/rule'
import type { RuleTranslator } from '@/utils/rule-presenter'

/**
 * 规则树编辑器的上下文：递归子组件不直接改 props，
 * 而是按节点 id 回调顶层做不可变更新（见 `utils/rule-tree-ops.ts`）。
 */
export interface RuleEditorContext {
  /** 后端下发的字段 / 操作符元数据；未就绪时为 null，编辑器外壳会显示加载态 */
  meta: Readonly<Ref<RuleMeta | null>>
  t: RuleTranslator
  updateCondition: (id: string, patch: Partial<Omit<ConditionNode, 'type' | 'id'>>) => void
  setLogicOperator: (id: string, operator: 'and' | 'or') => void
  removeNode: (id: string) => void
  addCondition: (parentId: string) => void
  addLogicGroup: (parentId: string) => void
}

export const RULE_EDITOR_KEY: InjectionKey<RuleEditorContext> = Symbol('rule-editor')
