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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** 由 vite.config.ts 的 define 注入，值为 package.json 的 version */
declare const __APP_VERSION__: string
