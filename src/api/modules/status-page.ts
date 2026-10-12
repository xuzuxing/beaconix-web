import type { AxiosRequestConfig } from 'axios'

import type {
  CreateStatusPageParams,
  PublicStatusPage,
  StatusPage,
  UpdateStatusPageParams,
} from '../types/status-page'
import { del, get, patch, post } from '@/utils/request'

/** 组织下的状态页列表 */
export function listStatusPages(orgId: string, config?: AxiosRequestConfig) {
  return get<StatusPage[]>(
    `/organizations/${encodeURIComponent(orgId)}/status-pages`,
    undefined,
    config,
  )
}

export function createStatusPage(orgId: string, data: CreateStatusPageParams) {
  return post<StatusPage>(`/organizations/${encodeURIComponent(orgId)}/status-pages`, data)
}

export function getStatusPage(orgId: string, id: string, config?: AxiosRequestConfig) {
  return get<StatusPage>(
    `/organizations/${encodeURIComponent(orgId)}/status-pages/${encodeURIComponent(id)}`,
    undefined,
    config,
  )
}

export function updateStatusPage(orgId: string, id: string, data: UpdateStatusPageParams) {
  return patch<StatusPage>(
    `/organizations/${encodeURIComponent(orgId)}/status-pages/${encodeURIComponent(id)}`,
    data,
  )
}

export function deleteStatusPage(orgId: string, id: string) {
  return del<void>(
    `/organizations/${encodeURIComponent(orgId)}/status-pages/${encodeURIComponent(id)}`,
  )
}

/**
 * 公开状态页：无需登录，供 `/status/{slug}` 与概览页的整体状态聚合使用。
 * 页面被停用或不存在时后端返回 404。
 */
export function getPublicStatusPage(slug: string, config?: AxiosRequestConfig) {
  return get<PublicStatusPage>(`/status/${encodeURIComponent(slug)}`, undefined, config)
}
