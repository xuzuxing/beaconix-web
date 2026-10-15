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
 *
 * `tz` 取访客所在时区：后端按它把检测样本分到当地日期与小时，
 * 若交给服务端默认时区，海外访客会看到错位的一天。
 */
export function getPublicStatusPage(slug: string, config?: AxiosRequestConfig) {
  return get<PublicStatusPage>(
    `/status/${encodeURIComponent(slug)}`,
    { tz: visitorTimeZone() },
    config,
  )
}

/** 访客的 IANA 时区；取不到时省略参数，由后端使用默认时区。 */
function visitorTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}
