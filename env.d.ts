/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 应用标题 */
  readonly VITE_APP_TITLE: string
  /** 默认语言 */
  readonly VITE_APP_LOCALE: 'zh-CN' | 'en-US'
  /** 打包路径 */
  readonly VITE_BASE_URL?: string
  /** 接口基础路径 */
  readonly VITE_API_BASE_URL: string
  /** 请求超时时间（毫秒） */
  readonly VITE_API_TIMEOUT?: string
  /** 业务成功状态码 */
  readonly VITE_API_SUCCESS_CODE?: string
  /** 开发服务器端口 */
  readonly VITE_DEV_PORT?: string
  /** 开发服务器代理目标 */
  readonly VITE_PROXY_TARGET?: string
  /** 公开状态页热力图演示数据开关：dev 默认开启，'0' 关闭，'1' 在非 dev 构建中也开启 */
  readonly VITE_STATUS_PAGE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** 由 vite.config.ts 的 define 注入，值为 package.json 的 version */
declare const __APP_VERSION__: string
