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

/** 成员关系 */
export interface Membership {
  id: string
  userId: string
  organizationId: string
  role: MembershipRole
  joinedAt: string
  updatedAt: string
  invitedById: string | null
}

/** 邀请 */
export interface Invitation {
  id: string
  email: string
  organizationId: string
  role: InvitableRole
  status: InvitationStatus
  /** 邀请令牌，接受/拒绝接口使用 */
  token: string
  expiresAt: string
  sentById: string
  acceptedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInvitationParams {
  email: string
  role?: InvitableRole
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

export type MonitorType = 'HTTP' | 'TCP'

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
  notificationChannelIds: string[]
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
}

export interface CreateMonitorParams {
  name: string
  type: MonitorType
  /** HTTP 用 URL，TCP 用 host:port */
  target: string
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
