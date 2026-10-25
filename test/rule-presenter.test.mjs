import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  collectRuleFields,
  countRuleNodes,
  defaultRuleTree,
  describeRuleTree,
  formatConditionText,
  instantiateRuleTree,
  isLogicNode,
  normalizeMultiValues,
  summarizeRuleTree,
  validateRuleTree,
} from '../src/utils/rule-presenter.ts'
import { RULE_TEMPLATES } from '../src/config/rules.ts'
import {
  appendRuleChild,
  conditionPatchFor,
  createConditionNode,
  createLogicNode,
  removeRuleNode,
  updateConditionNode,
  updateLogicOperator,
} from '../src/utils/rule-tree-ops.ts'

const dict = {
  'ruleGroup.field.success': '检查是否成功',
  'ruleGroup.field.latency': 'HTTP 总耗时（毫秒）',
  'ruleGroup.field.certDaysRemaining': '证书剩余天数',
  'ruleGroup.field.statusCode': 'HTTP 状态码',
  'ruleGroup.field.bodyContains': '响应体包含',
  'ruleGroup.operator.eq': '等于',
  'ruleGroup.operator.neq': '不等于',
  'ruleGroup.operator.gt': '大于',
  'ruleGroup.operator.gte': '大于等于',
  'ruleGroup.operator.lt': '小于',
  'ruleGroup.operator.lte': '小于等于',
  'ruleGroup.operator.in': '属于',
  'ruleGroup.operator.not_in': '不属于',
  'ruleGroup.operator.contains': '包含',
  'ruleGroup.operator.statusClass': '属于',
  'ruleGroup.statusClass.1': '1xx 信息',
  'ruleGroup.statusClass.2': '2xx 成功',
  'ruleGroup.statusClass.3': '3xx 重定向',
  'ruleGroup.statusClass.4': '4xx 客户端错误',
  'ruleGroup.statusClass.5': '5xx 服务器错误',
  'ruleGroup.value.true': '成功',
  'ruleGroup.value.false': '失败',
  'ruleGroup.logic.and': 'AND（全部满足）',
  'ruleGroup.logic.or': 'OR（任一满足）',
  'ruleGroup.joinAnd': ' 且 ',
  'ruleGroup.joinOr': ' 或 ',
}
const t = (key, params) =>
  (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ''))

/** 与后端 FIELD_META 同形，用于校验取值约束 */
const meta = {
  fields: ['success', 'latency', 'certDaysRemaining', 'statusCode', 'bodyContains'],
  meta: {
    success: {
      valueType: 'boolean',
      operators: ['eq', 'neq'],
      default: { operator: 'eq', value: true },
    },
    latency: {
      valueType: 'number',
      operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in'],
      constraints: { min: 0, integer: true },
      default: { operator: 'gt', value: 1000 },
    },
    certDaysRemaining: {
      valueType: 'number',
      operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in'],
      constraints: { min: -3650, integer: true },
      default: { operator: 'lte', value: 30 },
    },
    statusCode: {
      valueType: 'number',
      operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'statusClass'],
      constraints: { min: 100, max: 599, integer: true },
      default: { operator: 'eq', value: 200 },
    },
    bodyContains: {
      valueType: 'string',
      operators: ['eq', 'neq', 'contains', 'in', 'not_in'],
      constraints: { maxLength: 512 },
      default: { operator: 'contains', value: '' },
    },
  },
  statusClassValues: [1, 2, 3, 4, 5],
}

const condition = (over) => ({
  type: 'condition',
  id: 'c',
  field: 'latency',
  operator: 'gt',
  value: 1000,
  ...over,
})

test('statusClass / 多值 / 布尔阈值渲染成可读文案', () => {
  assert.equal(
    formatConditionText(condition({ field: 'statusCode', operator: 'statusClass', value: [5] }), t),
    'HTTP 状态码 属于 5xx 服务器错误',
  )
  assert.equal(
    formatConditionText(condition({ field: 'statusCode', operator: 'in', value: [200, 204] }), t),
    'HTTP 状态码 属于 [200、204]',
  )
  assert.equal(
    formatConditionText(condition({ field: 'success', operator: 'eq', value: false }), t),
    '检查是否成功 等于 失败',
  )
  assert.equal(
    formatConditionText(condition({ field: 'latency', operator: 'gt', value: 3000 }), t),
    'HTTP 总耗时（毫秒） 大于 3000',
  )
  assert.equal(
    formatConditionText(
      condition({
        field: 'bodyContains',
        operator: 'contains',
        value: 'db is down',
      }),
      t,
    ),
    '响应体包含 包含 「db is down」',
  )
  // 逗号分隔字符串与数组等价，空值给占位符
  assert.deepEqual(normalizeMultiValues('5, 4 ,'), ['5', '4'])
  assert.equal(
    formatConditionText(condition({ field: 'statusCode', operator: 'statusClass', value: '' }), t),
    'HTTP 状态码 属于 —',
  )
})

test('模板计数与字段提取', () => {
  assert.deepEqual(countRuleNodes(RULE_TEMPLATES.HTTP), {
    conditions: 4,
    logics: 2,
  })
  assert.deepEqual(countRuleNodes(RULE_TEMPLATES.TCP), {
    conditions: 2,
    logics: 1,
  })
  assert.deepEqual(collectRuleFields(RULE_TEMPLATES.HTTP), [
    'statusCode',
    'latency',
    'success',
    'certDaysRemaining',
  ])
  assert.deepEqual(describeRuleTree(RULE_TEMPLATES.TCP, t), {
    kind: 'logic',
    id: 'tpl-tcp-root',
    operator: 'or',
    label: 'OR（任一满足）',
    children: [
      {
        kind: 'condition',
        id: 'tpl-tcp-failed',
        text: '检查是否成功 等于 失败',
      },
      {
        kind: 'condition',
        id: 'tpl-tcp-slow',
        text: 'HTTP 总耗时（毫秒） 大于 3000',
      },
    ],
  })
})

test('summarizeRuleTree 用且/或连接整棵树', () => {
  assert.equal(
    summarizeRuleTree(RULE_TEMPLATES.HTTP, t),
    'HTTP 状态码 属于 5xx 服务器错误 且 HTTP 总耗时（毫秒） 大于 3000 或 检查是否成功 等于 失败 或 证书剩余天数 小于 7',
  )
})

test('defaultRuleTree / instantiateRuleTree 每次生成全新的节点 id', () => {
  const first = defaultRuleTree('HTTP')
  const second = defaultRuleTree('HTTP')
  assert.notEqual(first.id, second.id)
  assert.deepEqual(countRuleNodes(first), countRuleNodes(RULE_TEMPLATES.HTTP))
  const ids = (node) => (isLogicNode(node) ? [node.id, ...node.children.flatMap(ids)] : [node.id])
  assert.equal(
    ids(first).some((id) => ids(second).includes(id)),
    false,
  )
  // 模板本身不被改写
  assert.equal(RULE_TEMPLATES.HTTP.id, 'tpl-http-root')
  // 副本与原树内容一致（除 id 外）
  assert.deepEqual(
    instantiateRuleTree(RULE_TEMPLATES.TCP).children.at(0).value,
    RULE_TEMPLATES.TCP.children.at(0).value,
  )
  // 非 HTTP 协议回落到 TCP 模板
  assert.deepEqual(countRuleNodes(defaultRuleTree('TCP')), {
    conditions: 2,
    logics: 1,
  })
  assert.deepEqual(countRuleNodes(defaultRuleTree(null)), {
    conditions: 2,
    logics: 1,
  })
})

test('validateRuleTree 接受合法模板，逐项复现后端校验', () => {
  assert.deepEqual(validateRuleTree(RULE_TEMPLATES.HTTP, meta), [])
  assert.deepEqual(validateRuleTree(RULE_TEMPLATES.TCP, meta), [])

  const emptyGroup = { type: 'logic', id: 'g1', operator: 'and', children: [] }
  assert.deepEqual(
    validateRuleTree(emptyGroup, meta).map((issue) => issue.messageKey),
    ['ruleGroup.issue.emptyGroup'],
  )

  assert.deepEqual(
    validateRuleTree(
      condition({ field: 'statusCode', operator: 'statusClass', value: [7] }),
      meta,
    ).map((issue) => issue.messageKey),
    ['ruleGroup.issue.statusClass'],
  )
  assert.deepEqual(
    validateRuleTree(condition({ field: 'statusCode', operator: 'eq', value: 700 }), meta).map(
      (issue) => issue.messageKey,
    ),
    ['ruleGroup.issue.valueRange'],
  )
  assert.deepEqual(
    validateRuleTree(condition({ field: 'latency', operator: 'gt', value: 1.5 }), meta).map(
      (issue) => issue.messageKey,
    ),
    ['ruleGroup.issue.valueInteger'],
  )
  assert.deepEqual(
    validateRuleTree(condition({ field: 'latency', operator: 'gt', value: 'abc' }), meta).map(
      (issue) => issue.messageKey,
    ),
    ['ruleGroup.issue.valueNumber'],
  )
  assert.deepEqual(
    validateRuleTree(condition({ field: 'success', operator: 'eq', value: 'true' }), meta).map(
      (issue) => issue.messageKey,
    ),
    ['ruleGroup.issue.valueBoolean'],
  )
  assert.deepEqual(
    validateRuleTree(
      condition({ field: 'latency', operator: 'statusClass', value: [5] }),
      meta,
    ).map((issue) => issue.messageKey),
    ['ruleGroup.issue.fieldOperator'],
  )
  assert.deepEqual(
    validateRuleTree(condition({ value: '' }), meta).map((issue) => issue.messageKey),
    ['ruleGroup.issue.valueRequired'],
  )
  assert.deepEqual(
    validateRuleTree(
      condition({
        field: 'bodyContains',
        operator: 'contains',
        value: 'x'.repeat(513),
      }),
      meta,
    ).map((issue) => issue.messageKey),
    ['ruleGroup.issue.valueTooLong'],
  )
})

test('validateRuleTree 在元数据未就绪时只做结构校验', () => {
  assert.deepEqual(validateRuleTree(condition({ field: 'statusCode', value: 700 }), null), [])
  assert.deepEqual(
    validateRuleTree({ type: 'logic', id: 'g', operator: 'and', children: [] }, null).map(
      (issue) => issue.messageKey,
    ),
    ['ruleGroup.issue.emptyGroup'],
  )
})

test('validateRuleTree 限制嵌套深度与非法节点类型', () => {
  let nested = { type: 'logic', id: 'deep-0', operator: 'and', children: [] }
  for (let depth = 1; depth <= 11; depth += 1)
    nested = {
      type: 'logic',
      id: `deep-${depth}`,
      operator: 'and',
      children: [nested],
    }
  assert.deepEqual(
    validateRuleTree(nested, meta).map((issue) => issue.messageKey),
    ['ruleGroup.issue.depth'],
  )
  assert.deepEqual(
    validateRuleTree(
      { type: 'logic', id: 'bad', operator: 'xor', children: [condition({})] },
      meta,
    ).map((issue) => issue.messageKey),
    ['ruleGroup.issue.logicOperator'],
  )
})

test('新建节点取元数据默认值', () => {
  const node = createConditionNode(meta)
  assert.equal(node.type, 'condition')
  assert.equal(node.field, 'success')
  assert.equal(node.operator, 'eq')
  assert.equal(node.value, true)
  assert.match(node.id, /^condition-/)
  // 指定字段时取该字段在后端元数据里的默认操作符与默认值
  const code = createConditionNode(meta, 'statusCode')
  assert.equal(code.field, 'statusCode')
  assert.equal(code.operator, 'eq')
  assert.equal(code.value, 200)
  assert.equal(createLogicNode().operator, 'and')
  assert.deepEqual(createLogicNode('or').children, [])
})

test('树操作按 id 增删改且保持不可变', () => {
  const source = defaultRuleTree('HTTP')
  const snapshot = JSON.stringify(source)
  const [statusGroup, failed] = source.children
  assert.equal(statusGroup.type, 'logic')

  // 追加到嵌套逻辑组
  const withRule = appendRuleChild(
    source,
    statusGroup.id,
    createConditionNode(meta, 'bodyContains'),
  )
  assert.equal(countRuleNodes(withRule).conditions, 5)
  assert.equal(countRuleNodes(withRule).logics, 2)
  assert.ok(collectRuleFields(withRule).includes('bodyContains'))
  // 不存在的父节点：原样返回同一引用
  assert.equal(appendRuleChild(source, 'missing', createConditionNode(meta)), source)

  // 改阈值与操作符
  const patched = updateConditionNode(withRule, failed.id, { value: true })
  assert.deepEqual(findFirst(patched, failed.id), { ...failed, value: true })
  assert.equal(updateLogicOperator(patched, statusGroup.id, 'or').children.at(0).operator, 'or')
  // 未命中 id：整棵树引用不变
  assert.equal(updateConditionNode(source, 'missing', { value: 1 }), source)
  assert.equal(updateLogicOperator(source, 'missing', 'or'), source)

  // 删除嵌套规则；根节点不可删除
  const trimmed = removeRuleNode(patched, failed.id)
  assert.equal(countRuleNodes(trimmed).conditions, 4)
  assert.equal(removeRuleNode(trimmed, trimmed.id), trimmed)
  assert.equal(removeRuleNode(trimmed, statusGroup.id).children.length, 1)

  // 源树始终未被就地修改
  assert.equal(JSON.stringify(source), snapshot)
})

test('conditionPatchFor 换指标 / 换运算符时给出正确阈值', () => {
  const slow = {
    type: 'condition',
    id: 'x',
    field: 'latency',
    operator: 'gt',
    value: 3000,
  }
  // 换指标 → 回到该指标在后端元数据里的默认操作符与默认值
  assert.deepEqual(conditionPatchFor(meta, slow, { field: 'statusCode' }), {
    field: 'statusCode',
    operator: 'eq',
    value: 200,
  })
  // 单值 → 多值：阈值变成数组（多值统一存字符串）
  assert.deepEqual(conditionPatchFor(meta, slow, { operator: 'in' }), {
    operator: 'in',
    value: ['3000'],
  })
  // statusClass 同样落到数组（用支持该运算符的 statusCode 字段）
  const code = {
    type: 'condition',
    id: 'c',
    field: 'statusCode',
    operator: 'eq',
    value: 200,
  }
  assert.deepEqual(conditionPatchFor(meta, code, { operator: 'statusClass' }), {
    operator: 'statusClass',
    value: ['200'],
  })
  // 多值 → 单值：数字字段取回首元素并转回 number
  const inList = {
    type: 'condition',
    id: 'y',
    field: 'statusCode',
    operator: 'in',
    value: ['200', '204'],
  }
  assert.deepEqual(conditionPatchFor(meta, inList, { operator: 'eq' }), {
    operator: 'eq',
    value: 200,
  })
  // 无变化 / 该字段不支持所选运算符 → 回落该字段的默认操作符与默认值
  assert.deepEqual(conditionPatchFor(meta, slow, { operator: 'gt' }), {})
  assert.deepEqual(conditionPatchFor(meta, slow, { operator: 'statusClass' }), {
    field: 'latency',
    operator: 'gt',
    value: 1000,
  })
})

function findFirst(node, id) {
  if (node.id === id) return node
  if (node.type === 'condition') return null
  for (const child of node.children) {
    const found = findFirst(child, id)
    if (found) return found
  }
  return null
}
