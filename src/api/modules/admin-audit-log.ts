import type { AxiosRequestConfig } from 'axios'

import type { AdminAuditLogPage, AdminAuditLogQuery } from '../types/admin'
import { get } from '@/utils/request'

/**
 * 管理后台 · 跨租户审计日志（仅 SUPER_ADMIN）。
 * 与组织内审计日志同构，额外支持按组织过滤；分页字段为 items / total / ...。
 */
export function listAdminAuditLogs(params?: AdminAuditLogQuery, config?: AxiosRequestConfig) {
  return get<AdminAuditLogPage>(
    '/admin/audit-logs',
    params as Record<string, unknown> | undefined,
    config,
  )
}
