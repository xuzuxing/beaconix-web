import type {
  ConditionNode,
  LogicNode,
  RuleField,
  RuleMeta,
  RuleNode,
  RuleOperator,
  RuleValueType,
} from '../api/types/rule.ts'
import {
  FIELD_LABEL_KEYS,
  FIELD_VALUE_TYPES,
  MAX_RULE_DEPTH,
  OPERATOR_LABEL_KEYS,
  RULE_TEMPLATES,
  STATUS_CLASS_LABEL_KEYS,
} from '../config/rules.ts'

/**
 * 规则树的纯函数工具：计数、只读文案、默认模板实例化，以及后端
 * `RuleEvaluatorService.validate()` 的前端镜像（保存前给出同类提示，但仍以后端结论为准）。
 * 不依赖 vue，便于 node --test 直接跑。
 */

/** 文案翻译函数：传 vue-i18n 的 t 的包装即可，测试里可注入假实现 */
export type RuleTranslator = (key: string, params?: Record<string, unknown>) => string

export function isLogicNode(node: RuleNode): node is LogicNode {
  return node.type === 'logic'
}

export function isConditionNode(node: RuleNode): node is ConditionNode {
  return node.type === 'condition'
}

let idSequence = 0

/** 生成规则树内唯一的节点 id（后端只用它定位报错与 explain 输出） */
export function createRuleNodeId(prefix: 'logic' | 'condition' = 'condition'): string {
  idSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}`
}

/** 统计规则条数与逻辑组个数（标题上的「共 N 条规则 / M 个逻辑组」） */
export function countRuleNodes(node: RuleNode): {
  conditions: number
  logics: number
} {
  if (isConditionNode(node)) return { conditions: 1, logics: 0 }
  return node.children.reduce(
    (acc, child) => {
      const next = countRuleNodes(child)
      return {
        conditions: acc.conditions + next.conditions,
        logics: acc.logics + next.logics,
      }
    },
    { conditions: 0, logics: 1 },
  )
}

export function collectConditions(node: RuleNode): ConditionNode[] {
  if (isConditionNode(node)) return [node]
  return node.children.flatMap((child) => collectConditions(child))
}

/** 树中用到的字段（与后端 `fieldsUsed` 口径一致） */
export function collectRuleFields(node: RuleNode): RuleField[] {
  return [...new Set(collectConditions(node).map((condition) => condition.field))]
}

/** 深拷贝并保留 id：本地编辑副本，避免直接改到接口返回的对象 */
export function cloneRuleTree<T extends RuleNode>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T
}

/** 深拷贝并重写全部 id：把模板或别人的规则组复制成一份新树 */
export function instantiateRuleTree(node: RuleNode): RuleNode {
  if (isLogicNode(node)) {
    return {
      type: 'logic',
      id: createRuleNodeId('logic'),
      operator: node.operator,
      children: node.children.map((child) => instantiateRuleTree(child)),
    }
  }
  return {
    type: 'condition',
    id: createRuleNodeId('condition'),
    field: node.field,
    operator: node.operator,
    value: Array.isArray(node.value) ? [...node.value] : node.value,
  }
}

/** 新建规则组默认加载的模板：HTTP 用状态码 / 耗时 / 证书模板，其余协议用连通性与耗时模板 */
export function defaultRuleTree(monitorType?: string | null): RuleNode {
  return instantiateRuleTree(monitorType === 'HTTP' ? RULE_TEMPLATES.HTTP : RULE_TEMPLATES.TCP)
}

/** 多值操作符的取值统一成字符串数组（后端同时接受数组与逗号分隔字符串） */
export function normalizeMultiValues(value: unknown): string[] {
  const items = Array.isArray(value) ? value : String(value ?? '').split(',')
  return items.map((item) => String(item).trim()).filter((item) => item !== '')
}

export function fieldLabel(field: RuleField, t: RuleTranslator): string {
  const key = FIELD_LABEL_KEYS[field]
  return key ? t(key) : String(field)
}

export function operatorLabel(operator: RuleOperator, t: RuleTranslator): string {
  const key = OPERATOR_LABEL_KEYS[operator]
  return key ? t(key) : String(operator)
}

function scalarText(value: unknown, type: RuleValueType, t: RuleTranslator): string {
  if (typeof value === 'boolean') return t(value ? 'ruleGroup.value.true' : 'ruleGroup.value.false')
  if (value === undefined || value === null || value === '') return '—'
  if (type === 'boolean')
    return t(String(value) === 'true' ? 'ruleGroup.value.true' : 'ruleGroup.value.false')
  if (type === 'string') return `「${String(value)}」`
  return String(value)
}

/** 阈值的展示文本：statusClass 渲染成 1xx~5xx 标签，多值加方括号 */
export function formatConditionValue(node: ConditionNode, t: RuleTranslator): string {
  const type = FIELD_VALUE_TYPES[node.field] ?? 'string'
  if (node.operator === 'statusClass') {
    const labels = normalizeMultiValues(node.value).map((value) => {
      const key = STATUS_CLASS_LABEL_KEYS[Number(value)]
      return key ? t(key) : String(value)
    })
    return labels.length ? labels.join('、') : '—'
  }
  if (node.operator === 'in' || node.operator === 'not_in') {
    const labels = normalizeMultiValues(node.value).map((value) => scalarText(value, type, t))
    return labels.length ? `[${labels.join('、')}]` : '[—]'
  }
  return scalarText(node.value, type, t)
}

/** 单条规则的一句话文案：「HTTP 状态码 属于 5xx 服务器错误」 */
export function formatConditionText(node: ConditionNode, t: RuleTranslator): string {
  return `${fieldLabel(node.field, t)} ${operatorLabel(node.operator, t)} ${formatConditionValue(node, t)}`
}

/** 只读视图用的树形文案结构（逻辑组带 operator 标签，叶子是整句文案） */
export type RuleNodeText =
  | {
      kind: 'logic'
      id: string
      operator: 'and' | 'or'
      label: string
      children: RuleNodeText[]
    }
  | { kind: 'condition'; id: string; text: string }

export function describeRuleTree(node: RuleNode, t: RuleTranslator): RuleNodeText {
  if (isConditionNode(node)) {
    return {
      kind: 'condition',
      id: node.id,
      text: formatConditionText(node, t),
    }
  }
  return {
    kind: 'logic',
    id: node.id,
    operator: node.operator,
    label: t(node.operator === 'and' ? 'ruleGroup.logic.and' : 'ruleGroup.logic.or'),
    children: node.children.map((child) => describeRuleTree(child, t)),
  }
}

/** 一行摘要：用「且 / 或」把整棵树的规则连起来 */
export function summarizeRuleTree(node: RuleNode, t: RuleTranslator): string {
  if (isConditionNode(node)) return formatConditionText(node, t)
  const join = t(node.operator === 'and' ? 'ruleGroup.joinAnd' : 'ruleGroup.joinOr')
  return node.children.map((child) => summarizeRuleTree(child, t)).join(join)
}

export interface RuleTreeIssue {
  /** 出问题的节点 id */
  id: string
  messageKey: string
  params?: Record<string, unknown>
}

/**
 * 镜像后端 `RuleEvaluatorService.validate()`：
 * 深度 ≤ MAX_RULE_DEPTH、逻辑组非空、字段与操作符匹配、阈值符合字段约束。
 * `meta` 未就绪（接口还没返回）时只做结构校验，避免误报。
 */
export function validateRuleTree(node: RuleNode, meta: RuleMeta | null): RuleTreeIssue[] {
  const issues: RuleTreeIssue[] = []

  const visit = (current: RuleNode, depth: number) => {
    if (depth > MAX_RULE_DEPTH) {
      issues.push({
        id: current.id,
        messageKey: 'ruleGroup.issue.depth',
        params: { max: MAX_RULE_DEPTH },
      })
      return
    }
    if (isLogicNode(current)) {
      if (current.operator !== 'and' && current.operator !== 'or')
        issues.push({
          id: current.id,
          messageKey: 'ruleGroup.issue.logicOperator',
        })
      if (current.children.length === 0)
        issues.push({
          id: current.id,
          messageKey: 'ruleGroup.issue.emptyGroup',
        })
      current.children.forEach((child) => visit(child, depth + 1))
      return
    }
    if (current.value === undefined || current.value === null || current.value === '') {
      issues.push({
        id: current.id,
        messageKey: 'ruleGroup.issue.valueRequired',
      })
      return
    }
    if (!meta) return
    const fieldMeta = meta.meta[current.field]
    if (!fieldMeta) {
      issues.push({ id: current.id, messageKey: 'ruleGroup.issue.field' })
      return
    }
    if (!fieldMeta.operators.includes(current.operator)) {
      issues.push({
        id: current.id,
        messageKey: 'ruleGroup.issue.fieldOperator',
        params: { field: fieldLabel(current.field, (key) => key) },
      })
      return
    }
    validateValue(current, fieldMeta)
  }

  const validateValue = (current: ConditionNode, fieldMeta: RuleMeta['meta'][RuleField]) => {
    if (current.operator === 'statusClass') {
      const allowed = meta?.statusClassValues ?? [1, 2, 3, 4, 5]
      const values = normalizeMultiValues(current.value).map(Number)
      if (!values.length || values.some((value) => !allowed.includes(value)))
        issues.push({
          id: current.id,
          messageKey: 'ruleGroup.issue.statusClass',
        })
      return
    }
    const multi = current.operator === 'in' || current.operator === 'not_in'
    const values = multi ? normalizeMultiValues(current.value) : [current.value]
    if (multi && values.length === 0) {
      issues.push({
        id: current.id,
        messageKey: 'ruleGroup.issue.valueRequired',
      })
      return
    }
    const constraints = fieldMeta.constraints ?? {}
    for (const raw of values) {
      if (fieldMeta.valueType === 'number') {
        const value = Number(raw)
        if (!Number.isFinite(value)) {
          issues.push({
            id: current.id,
            messageKey: 'ruleGroup.issue.valueNumber',
          })
        } else if (constraints.integer && !Number.isInteger(value)) {
          issues.push({
            id: current.id,
            messageKey: 'ruleGroup.issue.valueInteger',
          })
        } else if (constraints.min !== undefined && value < constraints.min) {
          issues.push({
            id: current.id,
            messageKey: 'ruleGroup.issue.valueRange',
            params: { min: constraints.min, max: constraints.max ?? '∞' },
          })
        } else if (constraints.max !== undefined && value > constraints.max) {
          issues.push({
            id: current.id,
            messageKey: 'ruleGroup.issue.valueRange',
            params: { min: constraints.min ?? '-∞', max: constraints.max },
          })
        }
        continue
      }
      if (fieldMeta.valueType === 'boolean') {
        if (typeof raw !== 'boolean')
          issues.push({
            id: current.id,
            messageKey: 'ruleGroup.issue.valueBoolean',
          })
        continue
      }
      if (constraints.maxLength !== undefined && String(raw).length > constraints.maxLength)
        issues.push({
          id: current.id,
          messageKey: 'ruleGroup.issue.valueTooLong',
          params: { max: constraints.maxLength },
        })
    }
  }

  visit(node, 0)
  return issues
}
