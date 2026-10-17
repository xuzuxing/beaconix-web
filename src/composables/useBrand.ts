import { computed } from 'vue'

import defaultLogo from '@/assets/logo/default.png'
import whiteLogo from '@/assets/logo/white-logo.png'
import { APP_TITLE } from '@/config'
import { useAppStore } from '@/stores'

import { usePublicSettings } from './usePublicSettings'

/**
 * 站点品牌：优先用平台配置的公开项（`system.siteName` / `system.logoUrl` /
 * `system.faviconUrl`），没配置时回退到打包内置的名字与跟随明暗主题的双色 logo。
 *
 * 配置的 logo 是单个地址，不区分明暗主题；内置 logo 仍随主题切换。
 */
export function useBrand() {
  const appStore = useAppStore()
  const { text, logoUrl, faviconUrl, footerCopyright, icpLicense, maintenanceMode } =
    usePublicSettings()

  return {
    siteName: computed(() => text('system.siteName', APP_TITLE)),
    logoSrc: computed(() => logoUrl.value || (appStore.isDark ? whiteLogo : defaultLogo)),
    faviconUrl,
    footerCopyright,
    icpLicense,
    maintenanceMode,
  }
}
