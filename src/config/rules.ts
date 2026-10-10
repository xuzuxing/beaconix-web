import type { RuleField, RuleNode, RuleOperator, RuleValueType } from '../api/types/rule.ts'

/**
 * 规则编辑器的静态配置：字段 / 操作符 / 状态码类别的展示文案 key，以及新建规则组时
 * 可一键加载的默认规则模板。
 *
 * 取值范围（可用的操作符、数值上下限、默认值）不在这里定义——那份元数据的唯一事实源
 * 是后端 FIELD_META，页面通过 `GET /rule-meta` 拉取（见 `useRuleMeta`）。
 */

/** 规则树最大嵌套层数，与后端 RuleEvaluatorService.MAX_DEPTH 保持一致 */
export const MAX_RULE_DEPTH = 10

/** 条件字段的中文语义文案 key */
export const FIELD_LABEL_KEYS: Record<RuleField, string> = {
  success: 'ruleGroup.field.success',
  latency: 'ruleGroup.field.latency',
  certDaysRemaining: 'ruleGroup.field.certDaysRemaining',
  statusCode: 'ruleGroup.field.statusCode',
  bodyContains: 'ruleGroup.field.bodyContains',
}

/**
 * 取字段的文案 key。
 * 规则组实体的 `fieldsUsed` 在后端是 `string[]`（历史数据可能含已下线字段），
 * 因此这里接受任意字符串，未知字段由调用方原样展示。
 */
export function fieldLabelKey(field: string): string | undefined {
  return (FIELD_LABEL_KEYS as Record<string, string | undefined>)[field]
}

export const OPERATOR_LABEL_KEYS: Record<RuleOperator, string> = {
  eq: 'ruleGroup.operator.eq',
  neq: 'ruleGroup.operator.neq',
  gt: 'ruleGroup.operator.gt',
  gte: 'ruleGroup.operator.gte',
  lt: 'ruleGroup.operator.lt',
  lte: 'ruleGroup.operator.lte',
  in: 'ruleGroup.operator.in',
  not_in: 'ruleGroup.operator.not_in',
  contains: 'ruleGroup.operator.contains',
  statusClass: 'ruleGroup.operator.statusClass',
}

/** statusClass 取值 1-5 对应的展示文案 key（1xx~5xx） */
export const STATUS_CLASS_LABEL_KEYS: Record<number, string> = {
  1: 'ruleGroup.statusClass.1',
  2: 'ruleGroup.statusClass.2',
  3: 'ruleGroup.statusClass.3',
  4: 'ruleGroup.statusClass.4',
  5: 'ruleGroup.statusClass.5',
}

/**
 * 字段的取值语义类型，与后端 FIELD_META[field].valueType 一致。
 * 只读展示（列表页、详情页）不依赖 `GET /rule-meta` 即可渲染阈值；
 * 编辑器里可用的操作符、取值约束与默认值仍以后端元数据为准。
 */
export const FIELD_VALUE_TYPES: Record<RuleField, RuleValueType> = {
  success: 'boolean',
  latency: 'number',
  certDaysRemaining: 'number',
  statusCode: 'number',
  bodyContains: 'string',
}

/** 需要多值输入的操作符（value 存数组，后端也接受逗号分隔字符串） */
export const MULTI_VALUE_OPERATORS: RuleOperator[] = ['in', 'not_in', 'statusClass']

/**
 * 默认规则模板。id 只是占位，实例化时由 `instantiateRuleTree()` 重写为唯一 id。
 * - HTTP：5xx 或耗时超阈值，或检查失败，或证书剩余天数过低 → 判定异常
 * - TCP：连接失败或耗时超阈值 → 判定异常
 */
export const RULE_TEMPLATES: Record<'HTTP' | 'TCP', RuleNode> = {
  HTTP: {
    type: 'logic',
    id: 'tpl-http-root',
    operator: 'or',
    children: [
      {
        type: 'logic',
        id: 'tpl-http-status',
        operator: 'and',
        children: [
          {
            type: 'condition',
            id: 'tpl-http-5xx',
            field: 'statusCode',
            operator: 'statusClass',
            value: [5],
          },
          { type: 'condition', id: 'tpl-http-slow', field: 'latency', operator: 'gt', value: 3000 },
        ],
      },
      { type: 'condition', id: 'tpl-http-failed', field: 'success', operator: 'eq', value: false },
      {
        type: 'condition',
        id: 'tpl-http-cert',
        field: 'certDaysRemaining',
        operator: 'lt',
        value: 7,
      },
    ],
  },
  TCP: {
    type: 'logic',
    id: 'tpl-tcp-root',
    operator: 'or',
    children: [
      { type: 'condition', id: 'tpl-tcp-failed', field: 'success', operator: 'eq', value: false },
      { type: 'condition', id: 'tpl-tcp-slow', field: 'latency', operator: 'gt', value: 3000 },
    ],
  },
}
