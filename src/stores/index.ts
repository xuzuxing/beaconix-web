import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

/** 全局唯一的 pinia 实例，main.ts 中安装，请求层等非组件环境可按需引入 */
export const pinia = createPinia()

// 状态持久化插件，store 中通过 persist 选项开启
pinia.use(piniaPluginPersistedstate)

export * from './modules/app'
export * from './modules/counter'
export * from './modules/env'
export * from './modules/organization'
export * from './modules/user'
