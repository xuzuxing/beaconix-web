import type { HttpJsonAssertion, MonitorConfig, MonitorType } from '../api/types.ts'

/**
 * 协议配置工具：把「新增/编辑监控」表单里的协议字段整理成后端
 * `CreateMonitorDto.config` / `UpdateMonitorDto.config` 的形状。
 *
 * 后端对 config 是「整体替换」语义，且 password / token / tlsKey 等
 * 只写字段不回传，因此这里的取舍是：调用方只在用户确实改动过配置时提交
 * config，否则整段省略以保留已保存的凭据（见 MonitorEditorDialog）。
 */

/** 协议下拉选项：顺序与后端 MonitorType 枚举一致 */
export const MONITOR_TYPE_OPTIONS: { labelKey: string; value: MonitorType }[] = [
  { labelKey: 'workspace.monitor.protocol.HTTP', value: 'HTTP' },
  { labelKey: 'workspace.monitor.protocol.TCP', value: 'TCP' },
  { labelKey: 'workspace.monitor.protocol.PING', value: 'PING' },
  { labelKey: 'workspace.monitor.protocol.DNS', value: 'DNS' },
  { labelKey: 'workspace.monitor.protocol.MYSQL', value: 'MYSQL' },
  { labelKey: 'workspace.monitor.protocol.POSTGRESQL', value: 'POSTGRESQL' },
  { labelKey: 'workspace.monitor.protocol.REDIS', value: 'REDIS' },
  { labelKey: 'workspace.monitor.protocol.MONGODB', value: 'MONGODB' },
  { labelKey: 'workspace.monitor.protocol.DOCKER', value: 'DOCKER' },
  { labelKey: 'workspace.monitor.protocol.GRPC', value: 'GRPC' },
  { labelKey: 'workspace.monitor.protocol.WEBSOCKET', value: 'WEBSOCKET' },
]

/** target 目标形态：决定占位提示与示例（同一形态的协议共用文案） */
type TargetKind = 'http' | 'websocket' | 'hostPort' | 'domain' | 'hostname' | 'docker'

const TARGET_KIND: Record<MonitorType, TargetKind> = {
  HTTP: 'http',
  WEBSOCKET: 'websocket',
  TCP: 'hostPort',
  MYSQL: 'hostPort',
  POSTGRESQL: 'hostPort',
  REDIS: 'hostPort',
  MONGODB: 'hostPort',
  GRPC: 'hostPort',
  DNS: 'domain',
  PING: 'hostname',
  DOCKER: 'docker',
}

/** target 输入框占位文案的 i18n key */
export const monitorTargetPlaceholderKey = (type: MonitorType) =>
  `workspace.monitor.targetPlaceholder.${TARGET_KIND[type]}`

/** 含只写凭据字段的协议：编辑改配置时需要重新提交，留空会清除已保存的凭据 */
const CREDENTIAL_TYPES: MonitorType[] = [
  'MYSQL',
  'POSTGRESQL',
  'REDIS',
  'MONGODB',
  'DOCKER',
  'GRPC',
  'WEBSOCKET',
]

export const monitorConfigHasCredentials = (type: MonitorType) => CREDENTIAL_TYPES.includes(type)

/** 需要填写协议配置的协议（TCP / PING 无额外配置） */
export const monitorConfigIsEmpty = (type: MonitorType) => type === 'TCP' || type === 'PING'

/** 协议配置的默认值：新建或切换协议时用来初始化表单 */
export function monitorConfigDefaults(type: MonitorType): Record<string, unknown> {
  switch (type) {
    case 'HTTP':
      return { keyword: '', keywordMode: 'contains', jsonAssertions: [] }
    case 'DNS':
      return { recordType: 'A', expectedValues: [] }
    case 'MYSQL':
    case 'POSTGRESQL':
      return { username: '', password: '', database: '', tls: true, tlsCa: '' }
    case 'REDIS':
      return { username: '', password: '', db: 0, tls: true, tlsCa: '' }
    case 'MONGODB':
      return { username: '', password: '', database: '', authSource: 'admin', tls: true, tlsCa: '' }
    case 'DOCKER':
      return { containerId: '', token: '', tlsCa: '', tlsCert: '', tlsKey: '' }
    case 'GRPC':
      return { service: '', tls: true, tlsCa: '', token: '' }
    case 'WEBSOCKET':
      return { token: '', tlsCa: '' }
    default:
      return {}
  }
}

/** 浅合并后端返回的 config 到默认值上（只认已知字段，数组做深拷贝） */
export function monitorConfigDraft(
  type: MonitorType,
  source?: MonitorConfig | null,
): Record<string, unknown> {
  const draft = monitorConfigDefaults(type)
  if (!source) return draft
  const record = source as Record<string, unknown>
  for (const key of Object.keys(draft)) {
    if (!(key in record)) continue
    const value = record[key]
    draft[key] = Array.isArray(value) ? (JSON.parse(JSON.stringify(value)) as unknown[]) : value
  }
  return draft
}

/**
 * JSON 断言里的期望值：按字面量解析成后端接受的标量。
 * `true` / `false` / `null` 视为对应字面量，纯数字串视为数字，其余按字符串。
 */
export function parseAssertionValue(raw: string): string | number | boolean | null {
  const text = raw.trim()
  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return raw
}

/** 空字符串 / 空数组视为未填写；false、0、null 等有意义的值保留 */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value.trim() ? value : undefined
  if (Array.isArray(value)) return value.length ? value : undefined
  return value
}

/** 按协议挑出后端接受的字段，剔除未填写的可选值 */
export function monitorConfigPayload(type: MonitorType, raw: Record<string, unknown>): MonitorConfig {
  return buildPayload(type, raw) as MonitorConfig
}

function buildPayload(type: MonitorType, raw: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const put = (key: string, value: unknown) => {
    const normalized = normalize(value)
    if (normalized !== undefined) payload[key] = normalized
  }

  switch (type) {
    case 'HTTP': {
      // 关键字与 JSON 断言可以单独使用，也可以同时使用（AND）
      const keyword = typeof raw.keyword === 'string' ? raw.keyword.trim() : ''
      if (keyword) {
        payload.keyword = keyword
        payload.keywordMode = raw.keywordMode === 'notContains' ? 'notContains' : 'contains'
      }
      const assertions = Array.isArray(raw.jsonAssertions)
        ? (raw.jsonAssertions as HttpJsonAssertion[])
        : []
      if (assertions.length)
        payload.jsonAssertions = assertions.map((assertion) =>
          assertion.operator === 'exists' || assertion.operator === 'notExists'
            ? { path: assertion.path, operator: assertion.operator }
            : { path: assertion.path, operator: assertion.operator, value: assertion.value ?? null },
        )
      // 读取上限只在存在响应体断言时才有意义
      if (keyword || assertions.length) put('maxBodyBytes', raw.maxBodyBytes)
      return payload
    }
    case 'DNS': {
      payload.recordType = raw.recordType === 'AAAA' || raw.recordType === 'CNAME' ? raw.recordType : 'A'
      const values = Array.isArray(raw.expectedValues)
        ? raw.expectedValues
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean)
        : []
      if (values.length) payload.expectedValues = values
      return payload
    }
    case 'MYSQL':
    case 'POSTGRESQL': {
      put('username', raw.username)
      put('password', raw.password)
      put('database', raw.database)
      payload.tls = raw.tls !== false
      put('tlsCa', raw.tlsCa)
      return payload
    }
    case 'REDIS': {
      put('username', raw.username)
      put('password', raw.password)
      payload.db = typeof raw.db === 'number' ? raw.db : 0
      payload.tls = raw.tls !== false
      put('tlsCa', raw.tlsCa)
      return payload
    }
    case 'MONGODB': {
      put('username', raw.username)
      put('password', raw.password)
      put('database', raw.database)
      payload.authSource =
        typeof raw.authSource === 'string' && raw.authSource.trim() ? raw.authSource : 'admin'
      payload.tls = raw.tls !== false
      put('tlsCa', raw.tlsCa)
      return payload
    }
    case 'DOCKER': {
      put('containerId', raw.containerId)
      put('token', raw.token)
      put('tlsCa', raw.tlsCa)
      put('tlsCert', raw.tlsCert)
      put('tlsKey', raw.tlsKey)
      return payload
    }
    case 'GRPC': {
      put('service', raw.service)
      payload.tls = raw.tls !== false
      put('tlsCa', raw.tlsCa)
      put('token', raw.token)
      return payload
    }
    case 'WEBSOCKET': {
      put('token', raw.token)
      put('tlsCa', raw.tlsCa)
      return payload
    }
    default:
      return payload
  }
}
