import type {
  CheckLog,
  CreateMonitorParams,
  Monitor,
  MonitoringOverview,
  MonitorState,
  UpdateMonitorParams,
} from '../types'
import { del, get, patch, post } from '@/utils/request'
import type { AxiosRequestConfig } from 'axios'
import type { MonitorDetailRange, MonitorInsights } from '../types/monitor-detail'

/** 项目下的监控项列表 */
export function listMonitors(projectId: string, config?: AxiosRequestConfig) {
  return get<Monitor[]>(`/projects/${encodeURIComponent(projectId)}/monitors`, undefined, config)
}

/** 新建监控项 */
export function createMonitor(projectId: string, data: CreateMonitorParams) {
  return post<Monitor>(`/projects/${projectId}/monitors`, data)
}

export function getMonitor(projectId: string, id: string, config?: AxiosRequestConfig) {
  return get<Monitor>(`/projects/${encodeURIComponent(projectId)}/monitors/${encodeURIComponent(id)}`, undefined, config)
}

export function getMonitorInsights(projectId: string, id: string, params: { range: MonitorDetailRange; tz: string }, config?: AxiosRequestConfig) {
  return get<MonitorInsights>(`/projects/${encodeURIComponent(projectId)}/monitors/${encodeURIComponent(id)}/insights`, params, config)
}

export function updateMonitor(projectId: string, id: string, data: UpdateMonitorParams) {
  return patch<Monitor>(`/projects/${projectId}/monitors/${id}`, data)
}

/** 软删除监控项 */
export function deleteMonitor(projectId: string, id: string) {
  return del<Monitor>(`/projects/${projectId}/monitors/${id}`)
}

/** 暂停调度 */
export function pauseMonitor(projectId: string, id: string) {
  return post<Monitor>(`/projects/${projectId}/monitors/${id}/pause`)
}

/** 恢复调度 */
export function resumeMonitor(projectId: string, id: string) {
  return post<Monitor>(`/projects/${projectId}/monitors/${id}/resume`)
}

/** 恢复软删除的监控项 */
export function restoreMonitor(projectId: string, id: string) {
  return post<Monitor>(`/projects/${projectId}/monitors/${id}/restore`)
}

/** 向已绑定的告警渠道发送一条测试告警 */
export function testMonitorAlert(projectId: string, id: string) {
  return post<void>(`/projects/${projectId}/monitors/${id}/test-alert`)
}

/** 立即执行一次检查 */
export function runMonitorCheck(projectId: string, monitorId: string) {
  return post<CheckLog>(`/projects/${projectId}/monitors/${monitorId}/check`)
}

/** 监控项的检查历史 */
export function listMonitorChecks(
  projectId: string,
  monitorId: string,
  params?: { limit?: number },
) {
  return get<CheckLog[]>(`/projects/${projectId}/monitors/${monitorId}/checks`, params)
}

/** 监控项当前状态（含近 24 小时摘要） */
export function getMonitorState(projectId: string, monitorId: string) {
  return get<MonitorState>(`/projects/${projectId}/monitors/${monitorId}/state`)
}

/** 项目级监控概览 */
export function getProjectMonitoringOverview(projectId: string) {
  return get<MonitoringOverview>(`/projects/${projectId}/monitoring/overview`)
}

/** 组织级监控概览 */
export function getOrganizationMonitoringOverview(orgId: string) {
  return get<MonitoringOverview>(`/organizations/${orgId}/monitoring/overview`)
}
