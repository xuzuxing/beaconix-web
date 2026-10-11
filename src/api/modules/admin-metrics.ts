import type { AdminMetricsOverview, AdminSchedulerHealth, AdminTenantMetric } from '../types/admin'
import { get } from '@/utils/request'

/**
 * 管理后台 · 平台指标（仅 SUPER_ADMIN）。
 * 三个接口都是只读快照，页面按需刷新。
 */

/** 平台整体用量概览 */
export function getAdminMetricsOverview() {
  return get<AdminMetricsOverview>('/admin/metrics/overview')
}

/** 调度器与队列健康度 */
export function getAdminSchedulerHealth() {
  return get<AdminSchedulerHealth>('/admin/metrics/scheduler')
}

/** 每个租户一行的用量指标 */
export function getAdminTenantMetrics() {
  return get<AdminTenantMetric[]>('/admin/metrics/tenants')
}
