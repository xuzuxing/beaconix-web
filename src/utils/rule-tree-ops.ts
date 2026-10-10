import type {
  ConditionNode,
  LogicNode,
  RuleField,
  RuleMeta,
  RuleNode,
  RuleOperator,
} from '../api/types/rule.ts'
import { createRuleNodeId, normalizeMultiValues } from './rule-presenter.ts'

/**
 * 规则树的结构编辑：全部返回新树（不可变更新），便于在 Vue 的 model 上直接赋值，
 * 也让"按节点 id 增删改"不依赖 props 深层变异。根节点始终保留，只能被替换。
 */

/** 新建一条条件：操作符与阈值取该字段在后端元数据里的默认值 */
export function createConditionNode(meta: RuleMeta, field?: RuleField): ConditionNode {
  const target = field ?? meta.fields[0] ?? 'latency'
  const fieldMeta = meta.meta[target]
  return {
    type: 'condition',
    id: createRuleNodeId('condition'),
    field: target,
    operator: fieldMeta?.default.operator ?? 'eq',
    value: Array.isArray(fieldMeta?.default.value) ? [...fieldMeta.default.value] : fieldMeta?.default.value,
  }
}

/** 新建一个空逻辑组：编辑器会提示"逻辑组至少需要一条规则" */
export function createLogicNode(operator: 'and' | 'or' = 'and'): LogicNode {
  return { type: 'logic', id: createRuleNodeId('logic'), operator, children: [] }
}

function sameNodes(before: RuleNode[], after: RuleNode[]): boolean {
  return before.length === after.length && before.every((node, index) => node === after[index])
}

export function updateConditionNode(
  root: RuleNode,
  id: string,
  patch: Partial<Omit<ConditionNode, 'type' | 'id'>>,
): RuleNode {
  if (root.type === 'condition')
    return root.id === id ? { ...root, ...patch, type: 'condition', id: root.id } : root
  const children = root.children.map((child) => updateConditionNode(child, id, patch))
  return sameNodes(root.children, children) ? root : { ...root, children }
}

export function updateLogicOperator(root: RuleNode, id: string, operator: 'and' | 'or'): RuleNode {
  if (root.type === 'condition') return root
  if (root.id === id) return root.operator === operator ? root : { ...root, operator }
  const children = root.children.map((child) => updateLogicOperator(child, id, operator))
  return sameNodes(root.children, children) ? root : { ...root, children }
}

/** 删除某个节点（根节点不会被删除） */
export function removeRuleNode(root: RuleNode, id: string): RuleNode {
  if (root.type === 'condition') return root
  const kept = root.children.filter((child) => child.id !== id)
  if (kept.length === 0) return root
  const children = kept.map((child) => removeRuleNode(child, id))
  return sameNodes(root.children, children) ? root : { ...root, children }
}

/** 往指定逻辑组里追加子节点；parentId 不存在时原样返回 */
export function appendRuleChild(root: RuleNode, parentId: string, child: RuleNode): RuleNode {
  if (root.type === 'condition') return root
  if (root.id === parentId) return { ...root, children: [...root.children, child] }
  let changed = false
  const children = root.children.map((item) => {
    const next = appendRuleChild(item, parentId, child)
    if (next !== item) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

export function findRuleNode(root: RuleNode, id: string): RuleNode | null {
  if (root.id === id) return root
  if (root.type === 'condition') return null
  for (const child of root.children) {
    const found = findRuleNode(child, id)
    if (found) return found
  }
  return null
}

/** 多值阈值的操作符（value 存数组） */
const MULTI_OPERATORS: RuleOperator[] = ['in', 'not_in', 'statusClass']

function cloneValue(value: unknown): unknown {
  return Array.isArray(value) ? [...value] : value
}

/**
 * 指标 / 运算符变化时的派生值：
 * - 换指标 → 运算符与阈值回到该指标在后端元数据里的默认值
 * - 运算符在单值与多值之间切换 → 阈值在标量与数组之间转换
 *   （多值统一存字符串数组：编辑器用标签多选，后端 in/not_in/statusClass 也接受该形态）
 * 返回可直接用于 `updateConditionNode()` 的补丁（无变化时返回空对象）。
 */
export function conditionPatchFor(
  meta: RuleMeta,
  current: ConditionNode,
  change: { field?: RuleField; operator?: RuleOperator },
): Partial<Omit<ConditionNode, 'type' | 'id'>> {
  const field = change.field ?? current.field
  const fieldMeta = meta.meta[field]
  const numeric = fieldMeta?.valueType === 'number'
  const defaults = () => ({
    operator: fieldMeta?.default.operator ?? current.operator,
    value: cloneValue(fieldMeta?.default.value),
  })

  if (change.field !== undefined && change.field !== current.field) return { field, ...defaults() }

  const operator = change.operator ?? current.operator
  if (operator === current.operator) return {}
  if (!fieldMeta?.operators.includes(operator)) return { field, ...defaults() }

  const fromMulti = MULTI_OPERATORS.includes(current.operator)
  if (MULTI_OPERATORS.includes(operator)) {
    const values = normalizeMultiValues(current.value)
    return { operator, value: values.length ? values : defaults().value }
  }
  const items = fromMulti ? normalizeMultiValues(current.value) : []
  const fallback = items[0] ?? fieldMeta.default.value
  return { operator, value: numeric ? Number(fallback) : fallback }
}
