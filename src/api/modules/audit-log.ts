import type { AxiosRequestConfig } from 'axios'

import type { AuditLogPage, AuditLogQuery } from '../types/team'
import { get } from '@/utils/request'

/**
 * 组织审计日志（ADMIN+）。
 * 支持按操作人、项目、动作、实体与时间范围过滤，分页字段为 items / total / ...（见 AuditLogPage）。
 */
export function listAuditLogs(orgId: string, params?: AuditLogQuery, config?: AxiosRequestConfig) {
  return get<AuditLogPage>(
    `/organizations/${encodeURIComponent(orgId)}/audit-logs`,
    params as Record<string, unknown> | undefined,
    config,
  )
}
