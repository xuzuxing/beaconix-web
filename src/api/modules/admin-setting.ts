import type { AdminSetting, SettingValue, UpdateAdminSettingParams } from '../types/admin'
import { mockGetAdminSetting, mockListAdminSettings, mockUpdateAdminSetting } from '../mock/admin-settings'
import { get, patch } from '@/utils/request'

/**
 * 管理后台 · 平台运行时配置（仅 SUPER_ADMIN）。
 * 契约：GET /admin/settings、GET /admin/settings/:key、PATCH /admin/settings/:key。
 *
 * 后端接口仍在调整，先用内存 mock 顶替：
 * 把下面的开关改成 false 即切回真实接口，页面与 composable 不需要改动。
 */
export const SETTINGS_USE_MOCK = true

/** 全部配置项：已配置的值 + 后端内置默认 */
export function listAdminSettings() {
  if (SETTINGS_USE_MOCK) return mockListAdminSettings()
  return get<AdminSetting[]>('/admin/settings')
}

/** 单个配置项 */
export function getAdminSetting(key: string) {
  if (SETTINGS_USE_MOCK) return mockGetAdminSetting(key)
  return get<AdminSetting>(`/admin/settings/${encodeURIComponent(key)}`)
}

/** 写入单个配置项的值：name / description / valueType 等元数据仍由后端维护 */
export function updateAdminSetting(key: string, value: SettingValue) {
  if (SETTINGS_USE_MOCK) return mockUpdateAdminSetting(key, value)
  return patch<AdminSetting>(`/admin/settings/${encodeURIComponent(key)}`, {
    value,
  } satisfies UpdateAdminSettingParams)
}
