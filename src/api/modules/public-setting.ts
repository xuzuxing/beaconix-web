import type { PublicSettings } from '../types/public-setting'
import { get } from '@/utils/request'

/**
 * 公开的展示型配置（站点名称、Logo、页脚版权、默认语言、维护模式）。
 * 契约：`GET /settings/public`，无需登录。
 *
 * `X-Anonymous` 让请求层不要在 401 时尝试刷新 token（公开页面本来就没登录态）；
 * `X-Silent-Error` 让加载失败不弹全局提示，由页面自己决定怎么兜底。
 */
export function getPublicSettings() {
  return get<PublicSettings>('/settings/public', undefined, {
    headers: { 'X-Anonymous': '1', 'X-Silent-Error': '1' },
  })
}
