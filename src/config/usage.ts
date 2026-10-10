/**
 * 套餐用量页的静态示例数据。
 * 接入计费 / 用量接口后，把这些常量替换为请求结果即可（结构与字段保持不变）。
 */

/** 单项用量指标 */
export interface UsageMetric {
  /** 指标名的 i18n key，取值见 usage.metric.* */
  labelKey?: string
  /** 直接展示的名称，用于模型名这类专有名词（与 labelKey 二选一） */
  label?: string
  /** 展示值，字符串形式以保留原始精度（如 514.66） */
  value: string
  /** 单位的 i18n key，取值见 usage.unit.* */
  unitKey?: string
  /** 更新频率：按小时 / 按天 */
  update: 'hour' | 'day'
  /** 数值下方的补充说明（如「实时存储 2GB」） */
  extraKey?: string
  extraValue?: string
  /** 是否展示「详情」按钮（AI 模型用量使用） */
  detail?: boolean
}

/** 用量分组：一个分组一张卡片，卡片内按 3 列展示指标 */
export interface UsageGroup {
  /** 分组标识，同时用于匹配图标（见 UsageGroupCard） */
  key: string
  /** 分组名的 i18n key，取值见 usage.group.* */
  titleKey: string
  /** 该分组消耗的资源点，展示为「消耗X点」 */
  cost: string
  metrics: UsageMetric[]
}

/** AI 分组的模型用量：除知识库容量外，每个模型一项 token 用量 */
const AI_MODELS = [
  'hy3-preview',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'deepseek-v3.2',
  'glm-5.1',
  'glm-5v-turbo',
  'glm-5-turbo',
  'glm-5',
  'kimi-k2.6',
  'kimi-k2.5',
  'minimax-m2.7',
  'minimax-m2.5',
  'qwen3.5-plus',
  'deepseek-v4-flash-202605',
  'deepseek-v4-pro-202606',
  'qwen3.5-flash',
  'minimax-m3',
  'kimi-k2.7-code',
  'glm-5.2',
  'hy-mt2-pro',
  'hy-mt2-plus',
  'hy-mt2-lite',
  'hunyuan-role-latest',
  'hy-role',
  'kimi-k2.7-code-highspeed',
  'hy3',
  'kimi-k3',
  'mimo-v2.5-pro',
  'glm-5.3',
  'deepseek/deepseek-v4-flash-vision-exp',
  'deepseek-v4-flash-0731',
  'deepseek-v4-pro-0813',
  'glm-5.3-flash',
  'hy4-preview',
  'kimi-k2.8-preview',
  'deepseek/deepseek-flash',
  'glm-5.3-flashx',
  'hy-vision-2.0-instruct',
  'hunyuan-t1-vision-20250916',
  'hunyuan-turbos-vision-video-20250728',
  'mimo-v2.6-pro',
  'mimo-v2.6-flash',
  'deepseek-v4.1-flash',
  'step-5-preview',
]

/** 各分组用量：分组顺序即页面展示顺序 */
export const usageGroups: UsageGroup[] = [
  {
    key: 'db',
    titleKey: 'usage.group.db',
    cost: '0',
    metrics: [
      { labelKey: 'usage.metric.cu', value: '0', unitKey: 'usage.unit.coreSecond', update: 'hour' },
      {
        labelKey: 'usage.metric.dbCapacity',
        value: '0',
        unitKey: 'usage.unit.mbHour',
        update: 'hour',
        extraKey: 'usage.overview.realtimeStorage',
        extraValue: '2GB',
      },
    ],
  },
  {
    key: 'functions',
    titleKey: 'usage.group.functions',
    cost: '0.01',
    metrics: [
      { labelKey: 'usage.metric.fnResource', value: '0', unitKey: 'usage.unit.gbs', update: 'hour' },
      { labelKey: 'usage.metric.fnTraffic', value: '0', unitKey: 'usage.unit.kb', update: 'hour' },
      { labelKey: 'usage.metric.fnCalls', value: '3', unitKey: 'usage.unit.calls', update: 'hour' },
    ],
  },
  {
    key: 'container',
    titleKey: 'usage.group.container',
    cost: '0',
    metrics: [
      { labelKey: 'usage.metric.ccTraffic', value: '0', unitKey: 'usage.unit.byte', update: 'hour' },
      { labelKey: 'usage.metric.ccCpu', value: '0', unitKey: 'usage.unit.coreSecond', update: 'hour' },
      { labelKey: 'usage.metric.ccMemory', value: '0', unitKey: 'usage.unit.gbs', update: 'hour' },
    ],
  },
  {
    key: 'storage',
    titleKey: 'usage.group.storage',
    cost: '0',
    metrics: [
      {
        labelKey: 'usage.metric.storageCapacity',
        value: '0',
        unitKey: 'usage.unit.mbDay',
        update: 'day',
      },
      {
        labelKey: 'usage.metric.storageCalls',
        value: '1',
        unitKey: 'usage.unit.calls',
        update: 'day',
      },
      { labelKey: 'usage.metric.cdnOrigin', value: '0', unitKey: 'usage.unit.byte', update: 'day' },
      { labelKey: 'usage.metric.cdnTraffic', value: '0', unitKey: 'usage.unit.byte', update: 'day' },
      { labelKey: 'usage.metric.lowFreq', value: '0', unitKey: 'usage.unit.kb', update: 'day' },
      { labelKey: 'usage.metric.archive', value: '0', unitKey: 'usage.unit.kb', update: 'day' },
      { labelKey: 'usage.metric.ci', value: '0', unitKey: 'usage.unit.point', update: 'day' },
    ],
  },
  {
    key: 'ai',
    titleKey: 'usage.group.ai',
    cost: '0',
    metrics: [
      {
        labelKey: 'usage.metric.kbCapacity',
        value: '0',
        unitKey: 'usage.unit.mbDay',
        update: 'day',
        extraKey: 'usage.overview.realtimeStorage',
        extraValue: '0MB',
      },
      ...AI_MODELS.map<UsageMetric>((label) => ({
        label,
        value: '0',
        unitKey: 'usage.unit.tokens',
        update: 'hour',
        detail: true,
      })),
    ],
  },
  {
    key: 'staticHosting',
    titleKey: 'usage.group.staticHosting',
    cost: '0',
    metrics: [
      {
        labelKey: 'usage.metric.staticCapacity',
        value: '0',
        unitKey: 'usage.unit.mbDay',
        update: 'day',
        extraKey: 'usage.overview.realtimeStorage',
        extraValue: '0MB',
      },
      {
        labelKey: 'usage.metric.staticTraffic',
        value: '0',
        unitKey: 'usage.unit.byte',
        update: 'day',
      },
    ],
  },
  {
    key: 'invocation',
    titleKey: 'usage.group.invocation',
    cost: '0.38',
    metrics: [
      { labelKey: 'usage.metric.apiCalls', value: '38', unitKey: 'usage.unit.calls', update: 'hour' },
      { labelKey: 'usage.metric.httpCalls', value: '0', unitKey: 'usage.unit.calls', update: 'hour' },
      { labelKey: 'usage.metric.miniCalls', value: '0', unitKey: 'usage.unit.calls', update: 'hour' },
      { labelKey: 'usage.metric.qpsOver', value: '0', unitKey: 'usage.unit.qps', update: 'hour' },
      {
        labelKey: 'usage.metric.httpAccelReq',
        value: '0',
        unitKey: 'usage.unit.calls',
        update: 'day',
      },
      {
        labelKey: 'usage.metric.httpAccelTraffic',
        value: '0',
        unitKey: 'usage.unit.byte',
        update: 'day',
      },
    ],
  },
  {
    key: 'log',
    titleKey: 'usage.group.log',
    cost: '0.17',
    metrics: [
      { labelKey: 'usage.metric.logStorage', value: '1.75', unitKey: 'usage.unit.mb', update: 'day' },
      {
        labelKey: 'usage.metric.logTraffic',
        value: '514.66',
        unitKey: 'usage.unit.kb',
        update: 'day',
      },
    ],
  },
  {
    key: 'other',
    titleKey: 'usage.group.other',
    cost: '0',
    metrics: [
      { labelKey: 'usage.metric.sms', value: '0', unitKey: 'usage.unit.message', update: 'hour' },
    ],
  },
]

/** 套餐卡与用量概览顶部的动态数值 */
export const packageSummary = {
  /** 套餐有效期（至） */
  validUntil: '2027-01-22',
  /** 已消耗资源点 */
  usedPoints: '0.56',
  /** 当前套餐周期 */
  periodStart: '2026-09-23 00:00:00',
  periodEnd: '2026-10-22 23:59:59',
  /** 资源点使用比例（0.56 / 3000），供进度条使用 */
  pointsPercent: 0.02,
}
