// ============================================================
// 通用
// ============================================================

/** 分页查询参数 */
export interface PageQuery {
  page?: number
  limit?: number
}

/** 分页元信息（后端分页响应内层 meta） */
export interface PageMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * 分页响应。
 * 请求层已解包最外层 { data, meta: { timestamp } }，这里对应内层的 { data, meta }。
 */
export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

/**
 * 扁平分页响应。
 * 后端已把部分列表（当前用户通知、工单等）统一成 items 与计数器同级的结构，
 * 请求层解包最外层 `{ data, meta: { timestamp } }` 后拿到的就是这份。
 * 与 `Paginated<T>` 的差别仅在于列表字段叫 items、分页字段不再嵌一层 meta。
 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** 仅返回提示文案的响应 */
export interface MessageResponse {
  message: string
}

// ============================================================
// 认证 / 用户
// ============================================================

/** 全局角色 */
export type GlobalRole = 'SUPER_ADMIN' | 'USER'

/** 用户实体（/auth/me、登录返回的 user） */
export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  globalRole: GlobalRole
  isActive: boolean
  emailVerified: boolean
  lastSeenAt: string | null
  createdAt: string
  updatedAt: string
}

/** 登录 / 邮箱验证 / 刷新令牌 返回的令牌与用户 */
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

/**
 * 登录返回的两种形态：
 * - 未启用两步验证：直接拿到令牌与用户（AuthResponse）
 * - 已启用两步验证：先拿到挑战，需再调 /auth/2fa/verify-login 提交一次性验证码
 */
export interface TwoFactorChallenge {
  twoFactorRequired: true
  /** 挑战标识，验证时原样回传 */
  challengeId: string
  /** 挑战过期时间 */
  expiresAt: string
}

export type LoginResult = AuthResponse | TwoFactorChallenge

/** 提交两步验证验证码 */
export interface VerifyTwoFactorLoginParams {
  challengeId: string
  /** 身份验证器生成的动态验证码，或设备丢失时使用的恢复码 */
  code: string
}

/** 两步验证状态 */
export interface TwoFactorStatus {
  enabled: boolean
  enabledAt: string | null
  /** 剩余可用的恢复码数量 */
  recoveryCodesRemaining: number
}

/** 开始绑定两步验证：校验当前登录密码 */
export interface SetupTwoFactorParams {
  currentPassword: string
}

/**
 * 开始绑定的返回：一次性 setupToken、otpauth 链接与二维码图片（data URL）。
 * 密钥在 enable 之前不会落库，因此中途放弃不会改变账号状态。
 */
export interface TwoFactorSetup {
  setupToken: string
  otpauthUrl: string
  qrCodeDataUrl: string
  expiresAt: string
}

/** 提交验证码完成绑定 */
export interface EnableTwoFactorParams {
  setupToken: string
  /** 身份验证器生成的 6 位动态验证码 */
  code: string
}

/**
 * 恢复码集合：enable 与重置恢复码接口返回。
 * 明文只在本次响应中出现一次，页面必须提示用户立即离线保存。
 */
export interface RecoveryCodes {
  recoveryCodes: string[]
}

/** 重置恢复码 / 关闭两步验证：校验当前密码与一次性验证码 */
export interface SecondFactorConfirmParams {
  currentPassword: string
  /** 身份验证器动态验证码，或设备丢失时使用的恢复码 */
  code: string
}

export interface LoginParams {
  email: string
  password: string
}

export interface RegisterParams {
  email: string
  password: string
  name: string
}

export interface VerifyEmailParams {
  email: string
  /** 邮件里的 6 位验证码 */
  code: string
}

export interface ResendVerificationParams {
  email: string
}

export interface ForgotPasswordParams {
  email: string
}

export interface ResetPasswordParams {
  email: string
  code: string
  newPassword: string
}

export interface UpdateProfileParams {
  name?: string
  avatarUrl?: string
}

export interface ChangePasswordParams {
  currentPassword: string
  newPassword: string
}

// ============================================================
// 组织 / 成员 / 邀请
// ============================================================

/** 组织内的成员角色，权限自低到高 */
export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

/** 可邀请的角色（不含 OWNER） */
export type InvitableRole = 'ADMIN' | 'MEMBER' | 'VIEWER'

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED'

/** 组织 */
export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  website: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface CreateOrganizationParams {
  name: string
  /** URL 安全标识（小写、连字符，全平台唯一） */
  slug: string
  description?: string
  logoUrl?: string
  website?: string
}

export interface UpdateOrganizationParams {
  name?: string
  slug?: string
  description?: string
  logoUrl?: string
  website?: string
}

/**
 * 成员内嵌的用户概要。
 * 接口文档只承诺 `userId`，实际响应可能内嵌用户资料；
 * 缺失时前端回退展示 userId（见 utils/team-presenter.ts 的 memberIdentity）。
 */
export interface MembershipUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

/** 成员关系 */
export interface Membership {
  id: string
  userId: string
  organizationId: string
  role: MembershipRole
  joinedAt: string
  updatedAt: string
  invitedById: string | null
  /** 内嵌的用户资料，后端未内嵌时为 undefined */
  user?: MembershipUser | null
}

/** 邀请 */
export interface Invitation {
  id: string
  email: string
  organizationId: string
  role: InvitableRole
  status: InvitationStatus
  accessMode: import('./types/permissions').AccessMode
  projects: {
    projectId: string
    projectName: string
    role: import('./types/permissions').ProjectRole
  }[]
  expiresAt: string
  sentById: string
  acceptedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInvitationParams {
  email: string
  role?: InvitableRole
  projects?: import('./types/permissions').ProjectGrant[]
}

// ============================================================
// 项目
// ============================================================

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'

/** 项目 */
export interface Project {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  /** 组织内唯一的大写短码，用于任务编号（如 TFB-42） */
  key: string
  organizationId: string
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateProjectParams {
  name: string
  description?: string
  /** 大写字母短码，组织内唯一 */
  key: string
}

export interface UpdateProjectParams {
  name?: string
  description?: string
}

// ============================================================
// 监控
// ============================================================

export type MonitorType =
  | 'HTTP'
  | 'TCP'
  | 'PING'
  | 'DNS'
  | 'MYSQL'
  | 'POSTGRESQL'
  | 'REDIS'
  | 'MONGODB'
  | 'DOCKER'
  | 'GRPC'
  | 'WEBSOCKET'

// ---------- 协议配置（CreateMonitorDto.config / MonitorEntity.config） ----------

/** HTTP JSON 指针断言的比较操作符 */
export type HttpAssertionOperator = 'exists' | 'notExists' | 'eq' | 'neq'

/** HTTP 响应体的 JSON 指针断言；path 为空串表示根节点 */
export interface HttpJsonAssertion {
  path: string
  operator: HttpAssertionOperator
  /** eq / neq 的期望值（严格比较，不做类型转换）；exists / notExists 时省略 */
  value?: string | number | boolean | null
}

/** HTTP / HTTPS：关键字与 JSON 指针断言，多条断言之间为 AND */
export interface HttpMonitorConfig {
  keyword?: string
  /** 仅在填写 keyword 时生效 */
  keywordMode?: 'contains' | 'notContains'
  /** 仅在存在响应体断言时生效，统计解码后的响应字节数 */
  maxBodyBytes?: number
  jsonAssertions?: HttpJsonAssertion[]
}

/** DNS：记录类型与期望值 */
export interface DnsMonitorConfig {
  recordType?: 'A' | 'AAAA' | 'CNAME'
  expectedValues?: string[]
}

/** MYSQL / POSTGRESQL：SQL 固定为 SELECT 1 */
export interface SqlMonitorConfig {
  username: string
  /** 只写字段：响应不回传，替换 config 时必须重新提交 */
  password?: string
  database: string
  /** 默认 true */
  tls?: boolean
  /** 内联 PEM，不允许文件路径 */
  tlsCa?: string
}

/** REDIS */
export interface RedisMonitorConfig {
  username?: string
  password?: string
  /** 逻辑库序号 0 - 15，默认 0 */
  db?: number
  tls?: boolean
  tlsCa?: string
}

/** MONGODB */
export interface MongodbMonitorConfig {
  username?: string
  password?: string
  database?: string
  /** 认证库，默认 admin */
  authSource?: string
  tls?: boolean
  tlsCa?: string
}

/** DOCKER：HTTPS daemon 或运维授权的 unix socket */
export interface DockerMonitorConfig {
  containerId: string
  /** 只写字段 */
  token?: string
  tlsCa?: string
  /** 内联 PEM 客户端证书 */
  tlsCert?: string
  /** 只写字段，内联 PEM 私钥 */
  tlsKey?: string
}

/** GRPC：固定调用 grpc.health.v1.Health/Check */
export interface GrpcMonitorConfig {
  /** 服务名，默认空串（整体健康） */
  service?: string
  tls?: boolean
  tlsCa?: string
  /** 只写字段 */
  token?: string
}

/** WEBSOCKET：协议级 ping/pong；携带 token 时必须为 wss */
export interface WebsocketMonitorConfig {
  /** 只写字段 */
  token?: string
  tlsCa?: string
}

/** TCP / PING 不需要协议配置 */
export type EmptyMonitorConfig = Record<string, never>

/** 协议配置联合类型（TCP / PING 传空对象） */
export type MonitorConfig =
  | HttpMonitorConfig
  | DnsMonitorConfig
  | SqlMonitorConfig
  | RedisMonitorConfig
  | MongodbMonitorConfig
  | DockerMonitorConfig
  | GrpcMonitorConfig
  | WebsocketMonitorConfig
  | EmptyMonitorConfig

/** UNKNOWN（尚未检查）/ UP / DEGRADED / DOWN / PAUSED */
export type MonitorStatus = 'UNKNOWN' | 'UP' | 'DEGRADED' | 'DOWN' | 'PAUSED'

/** 检查执行位置：本地调度或探针上报 */
export type CheckSource = 'LOCAL' | 'PROBE'

/** 监控项 */
export interface Monitor {
  id: string
  organizationId: string
  projectId: string
  name: string
  type: MonitorType
  target: string
  /** 检查间隔（秒） */
  interval: number
  /** 超时（毫秒） */
  timeout: number
  /** 期望的 HTTP 状态码 */
  expectedStatus: number
  /** 连续失败多少次判定为 DOWN */
  failureThreshold: number
  checkSsl: boolean
  /** 证书到期前多少天开始告警 */
  sslExpiryThreshold: number
  enabled: boolean
  availabilityEnabled: boolean
  availabilityThreshold: number | null
  availabilityWindow: number | null
  /** 绑定的告警渠道，空表示走组织级兜底 */
  notificationChannelIds?: string[]
  status: MonitorStatus
  failCount: number
  lastCheckAt: string | null
  lastLatency: number | null
  lastError: string | null
  lastNotifiedStatus: MonitorStatus | null
  sslExpiresAt: string | null
  sslDaysRemaining: number | null
  sslIssuer: string | null
  sslSubject: string | null
  sslLastNotifiedAt: string | null
  createdAt: string
  updatedAt: string
  /** 协议配置；响应中不含 writeOnly 凭据（password / token / tlsKey） */
  config?: MonitorConfig
  /** 是否已配置凭据（凭据值永不回传） */
  hasCredentials?: boolean
  executionEligible?: boolean
  executionBlockedReason?: string | null
}

export interface CreateMonitorParams {
  name: string
  type: MonitorType
  /** HTTP/WS 用 URL，TCP/数据库/gRPC 用 host:port，DNS 用域名，PING 用主机名，Docker 用 HTTPS 源或 unix socket */
  target: string
  /** 协议配置；类型特有，省略 PATCH 时保留原凭据 */
  config?: MonitorConfig
  interval?: number
  timeout?: number
  expectedStatus?: number
  failureThreshold?: number
  checkSsl?: boolean
  sslExpiryThreshold?: number
  enabled?: boolean
  availabilityEnabled?: boolean
  availabilityThreshold?: number
  availabilityWindow?: number
  notificationChannelIds?: string[]
}

export type UpdateMonitorParams = Partial<CreateMonitorParams>

/** 监控当前状态（含近 24 小时摘要） */
export interface MonitorState {
  monitorId: string
  name: string
  target: string
  type: MonitorType
  status: MonitorStatus
  failCount: number
  lastCheckAt: string | null
  lastLatency: number | null
  lastError: string | null
  lastNotifiedStatus: MonitorStatus | null
  sslExpiresAt: string | null
  sslDaysRemaining: number | null
  sslIssuer: string | null
  sslSubject: string | null
  sslLastNotifiedAt: string | null
  updatedAt: string | null
  /** 近 24 小时可用率（%） */
  uptimePercent: number | null
  /** 近 24 小时平均延迟（毫秒） */
  avgLatency: number | null
}

/** 单次检查记录 */
export interface CheckLog {
  id: string
  monitorId: string
  success: boolean
  localSuccess: boolean | null
  /** 本地失败但被探针成功"救回" */
  rescuedByProbe: boolean
  /** 往返耗时（毫秒） */
  latency: number
  error: string | null
  statusCode: number | null
  source: CheckSource
  checkedAt: string
  /** 所属检查批次（round）ID，格式 `<monitorId>:<epochMs>`；批次化之前的记录为 null */
  roundId?: string | null
}

/** 监控概览（项目 / 组织两级共用结构） */
export interface MonitoringOverview {
  monitors: {
    total: number
    enabled: number
    paused: number
  }
  byStatus: Record<MonitorStatus, number>
  recentIncidents: {
    id: string
    name: string
    target: string
    status: MonitorStatus
    lastCheckAt: string | null
    lastError: string | null
  }[]
  avgLatency: number | null
  uptime: {
    totalChecks: number
    successfulChecks: number
    uptimePercent: number | null
  }
  /** 证书即将到期的监控项数量 */
  sslExpiringSoon: number
}
