import type { LocaleType } from '@/types'

/** 应用标题 */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'Beaconix Web'

/** 登录后或访问根路径时跳转的首页 */
export const HOME_PATH = '/dashboard'

/** 默认语言 */
export const DEFAULT_LOCALE: LocaleType =
  import.meta.env.VITE_APP_LOCALE === 'en-US' ? 'en-US' : 'zh-CN'

/** 可选语言列表，用于顶栏的语言切换 */
export const LOCALE_OPTIONS: { label: string; value: LocaleType }[] = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]

/** 请求超时时间（毫秒） */
export const REQUEST_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 15000)

/** 业务成功状态码 */
export const SUCCESS_CODE = Number(import.meta.env.VITE_API_SUCCESS_CODE ?? 0)
