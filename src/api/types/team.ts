// ============================================================
// 团队管理域：API 密钥与审计日志
// 组织 / 成员 / 邀请等核心实体仍在 api/types.ts，这里只放团队管理页新增的资源。
// ============================================================

/** API 密钥可授予的权限范围，对应后端 CreateApiKeyDto.scopes 的枚举 */
export type ApiKeyScope =
  | 'monitors:read'
  | 'monitors:write'
  | 'probes:read'
  | 'probes:write'
  | 'status-pages:read'
  | 'status-pages:write'
  | 'monitoring:read'

/** API 密钥 */
export interface ApiKey {
  id: string
  organizationId: string
  name: string
  /** 展示用前缀（如 bk_org_1a2b3c4d），列表接口不回传完整密钥 */
  keyPrefix: string
  scopes: ApiKeyScope[]
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  /** 完整密钥，仅创建响应返回一次，列表接口不返回 */
  key?: string
}

export interface CreateApiKeyParams {
  name: string
  scopes: ApiKeyScope[]
  /** 过期时间（ISO 8601）；不传表示永不过期 */
  expiresAt?: string
}

/** 审计动作，对应后端 AuditLogEntity.action 的枚举 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'ARCHIVE'
  | 'INVITE'
  | 'JOIN'
  | 'LEAVE'
  | 'ASSIGN'
  | 'UNASSIGN'
  | 'ENABLE_2FA'
  | 'DISABLE_2FA'
  | 'REGENERATE_RECOVERY_CODES'
  | 'USE_RECOVERY_CODE'

/** 审计日志条目（不可变） */
export interface AuditLog {
  id: string
  actorId: string | null
  organizationId: string | null
  projectId: string | null
  action: AuditAction
  /** 受影响实体的模型名，如 Task / Project */
  entity: string
  entityId: string
  /** 变更前快照 */
  before: Record<string, unknown> | null
  /** 变更后快照 */
  after: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

/** 审计日志查询参数（全部可选，未传即不按该维度过滤） */
export interface AuditLogQuery {
  actorId?: string
  projectId?: string
  action?: AuditAction
  entity?: string
  entityId?: string
  /** 起始时间（ISO 8601） */
  from?: string
  /** 结束时间（ISO 8601） */
  to?: string
  page?: number
  limit?: number
}

/**
 * 审计日志分页响应。
 * 注意与通用 `Paginated<T>` 不同：该接口直接返回 items / total / page / limit / totalPages，
 * 请求层解包最外层 `{ data, meta }` 后拿到的就是这份结构。
 */
export interface AuditLogPage {
  items: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}
