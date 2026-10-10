/**
 * 节点异常条件规则（规则树）契约。
 *
 * 与后端 `nest-beacon/src/modules/rules/types.ts` 一一对应：
 * - 规则树存 `RuleGroup.tree`（JSON），由 `RuleEvaluatorService.validate()` 递归校验
 * - 字段 / 操作符 / 取值范围 / 编辑器默认值由后端 `FIELD_META` 作为唯一事实源，
 *   通过 `GET /rule-meta` 下发，前端不硬编码取值范围
 */

/** 条件字段：success / latency / certDaysRemaining 为检测器一贯提供的核心字段 */
export type RuleField = 'success' | 'latency' | 'certDaysRemaining' | 'statusCode' | 'bodyContains'

export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'statusClass'

/** 叶子条件：某字段与阈值的比较 */
export interface ConditionNode {
  type: 'condition'
  id: string
  field: RuleField
  operator: RuleOperator
  /** 取值形态由操作符决定：statusClass/in/not_in 为数组或以逗号分隔的字符串 */
  value: unknown
}

/** 逻辑组：and（全部满足）/ or（任一满足），children 可继续嵌套逻辑组 */
export interface LogicNode {
  type: 'logic'
  id: string
  operator: 'and' | 'or'
  children: RuleNode[]
}

export type RuleNode = ConditionNode | LogicNode

/** value 的语义类型，编辑器据此渲染输入控件 */
export type RuleValueType = 'boolean' | 'number' | 'string'

/** 单个字段的元数据（GET /rule-meta 的 meta[field]） */
export interface RuleFieldMeta {
  valueType: RuleValueType
  operators: RuleOperator[]
  constraints?: {
    min?: number
    max?: number
    integer?: boolean
    maxLength?: number
  }
  /** 编辑器新增条件时的默认操作符与默认值 */
  default: { operator: RuleOperator; value: unknown }
}

/** GET /rule-meta 的返回体 */
export interface RuleMeta {
  fields: RuleField[]
  meta: Record<RuleField, RuleFieldMeta>
  /** statusClass 的合法取值：HTTP 状态码类别 1-5（对应 1xx~5xx） */
  statusClassValues: number[]
}

/** 规则组实体（列表 / 详情 / 创建 / 更新共用） */
export interface RuleGroup {
  id: string
  organizationId: string
  /** null = 组织级规则组；非空 = 项目级规则组 */
  projectId: string | null
  name: string
  description: string | null
  tree: RuleNode
  /** 树中用到的字段名（后端冗余字段，便于按字段反查） */
  fieldsUsed: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface CreateRuleGroupParams {
  name: string
  description?: string
  /** 项目级规则组时传入；不传则为组织级 */
  projectId?: string
  tree: RuleNode
}

export interface UpdateRuleGroupParams {
  name?: string
  description?: string
  /** 替换整棵规则树（后端会重新校验） */
  tree?: RuleNode
  enabled?: boolean
}

/** monitor ↔ 规则组 的绑定关系 */
export interface MonitorRuleBinding {
  id: string
  monitorId: string
  ruleGroupId: string
  /** 同一 monitor 绑定多个规则组时的优先级，数字越大越先求值 */
  priority: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  /** GET /rule-bindings 会一并返回规则组本体 */
  ruleGroup?: RuleGroup
}

export interface BindRuleParams {
  ruleGroupId: string
  priority?: number
}
