import { computed, ref, shallowRef } from 'vue'

import { getPublicSettings } from '@/api'
import type { PublicSettings } from '@/api/types/public-setting'

/** 缓存有效期：公开配置变动不频繁，5 分钟内复用同一份 */
const CACHE_TTL_MS = 5 * 60 * 1000

const settings = shallowRef<PublicSettings>({})
const loading = ref(false)
const error = ref('')
let loadedAt = 0
let inflight: Promise<void> | null = null

/** 清空缓存：重新登录、或单测里重置模块状态时用 */
export function resetPublicSettingsCache() {
  settings.value = {}
  loading.value = false
  error.value = ''
  loadedAt = 0
  inflight = null
}

/**
 * 公开配置（登录页、状态页这类未登录页面也要用）。
 *
 * 全应用共享一份内存副本，5 分钟内不会重复请求；并发调用合并成同一个请求。
 * 页面直接用下面的 computed，其它 key 用 `text` / `flag` 读。
 */
export function usePublicSettings() {
  async function load(force = false) {
    const fresh = loadedAt > 0 && Date.now() - loadedAt < CACHE_TTL_MS
    if (!force && fresh) return
    if (inflight) return inflight

    loading.value = true
    error.value = ''

    inflight = (async () => {
      try {
        settings.value = (await getPublicSettings()) ?? {}
        loadedAt = Date.now()
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : ''
      } finally {
        loading.value = false
        inflight = null
      }
    })()

    return inflight
  }

  function text(key: string, fallback = ''): string {
    const value = settings.value[key]
    return typeof value === 'string' && value !== '' ? value : fallback
  }

  function flag(key: string, fallback = false): boolean {
    const value = settings.value[key]
    return typeof value === 'boolean' ? value : fallback
  }

  return {
    /** 当前快照（只读） */
    settings: computed(() => settings.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    load,
    text,
    flag,
    siteName: computed(() => text('system.siteName', 'Beacon')),
    siteDescription: computed(() => text('system.siteDescription')),
    logoUrl: computed(() => text('system.logoUrl')),
    faviconUrl: computed(() => text('system.faviconUrl')),
    footerCopyright: computed(() => text('system.footerCopyright')),
    icpLicense: computed(() => text('system.icpLicense')),
    supportEmail: computed(() => text('system.supportEmail')),
    defaultLocale: computed(() => text('system.defaultLocale', 'zh-CN')),
    maintenanceMode: computed(() => flag('system.maintenanceMode')),
  }
}
