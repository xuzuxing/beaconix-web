import { createApp, watch } from 'vue'
import TDesign from 'tdesign-vue-next'

import App from './App.vue'
import { setupI18n } from './locales'
import router from './router'
import { pinia, useUserStore, useOrganizationStore } from './stores'
import { usePermissionsStore } from './stores/modules/permissions'
import { permissionEpoch, sessionEpoch } from './utils/access-context'
import { canVisitNavigation, navigationScope } from './utils/navigation-access'
import { setupRequestAuth } from './utils/request'
import { createRevalidateScheduler } from './utils/revalidate-schedule'

import 'tdesign-vue-next/es/style/index.css'
import '@/assets/styles/index.less'
// 全局路由守卫（挂在已创建的 router 上，作用时机在每次导航）
import './permission'

const app = createApp(App)

app.use(pinia)
app.use(TDesign)
app.use(router)

// i18n 的初始语言取自 pinia 中的持久化状态，需在 pinia 安装之后创建
setupI18n(app)

// 请求层与 store 解耦：token 与 401 处理在这里接线
// 请求层与 store 解耦：令牌读取、续期回写与登录失效处理在这里接线
setupRequestAuth({
  getAccessToken: () => useUserStore().accessToken,
  getRefreshToken: () => useUserStore().refreshToken,
  setTokens: (tokens) => useUserStore().setTokens(tokens),
  onUnauthorized: () => {
    useUserStore().reset()
    void router.replace({
      path: '/login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
  },
  onAccessDenied: (status, path) => {
    const org = useOrganizationStore()
    if (path.endsWith('/my-permissions')) return
    const currentScope =
      path.includes(`/organizations/${org.currentOrganizationId}/`) ||
      path.includes(`/projects/${org.currentProjectId}/`)
    if (!currentScope) return
    if (status === 403) void revalidate.trigger()
  },
})

let checking: Promise<void> | undefined
async function runRevalidate() {
  if (checking || !useUserStore().isLogin) return checking
  const session = sessionEpoch.value
  const org = useOrganizationStore()
  const revision = org.workspaceRevision
  const permissions = usePermissionsStore()
  checking = (async () => {
    const route = router.currentRoute.value
    if (navigationScope(route.path) === 'platform') {
      try {
        await useUserStore().loadUser()
      } catch {
        /* Keep the platform gate closed. */
      }
      if (session === sessionEpoch.value && !canVisitNavigation(route.path))
        await router.replace('/access-unavailable')
      return
    }
    if (!org.currentOrganizationId) return
    await permissions.ensureOrganization(org.currentOrganizationId, true)
    const projectId =
      typeof route.params.projectId === 'string' ? route.params.projectId : org.currentProjectId
    if (projectId) await permissions.ensureProject(projectId, true)
    if (session !== sessionEpoch.value || revision !== org.workspaceRevision) return
    if (
      org.workspaceState !== 'ready' ||
      !canVisitNavigation(router.currentRoute.value.path, projectId)
    ) {
      // 组织能力刚在上面强制刷新过，这里不必再 force，避免重复请求同一份 /my-permissions
      await org.loadWorkspace()
      if (session !== sessionEpoch.value || revision !== org.workspaceRevision) return
      const currentRoute = router.currentRoute.value
      const targetProjectId =
        typeof currentRoute.params.projectId === 'string'
          ? currentRoute.params.projectId
          : org.currentProjectId
      if (
        !canVisitNavigation(currentRoute.path, targetProjectId) &&
        navigationScope(currentRoute.path) !== 'account'
      )
        await router.replace('/access-unavailable')
    }
  })().finally(() => {
    checking = undefined
  })
  return checking
}

/**
 * 重验节流：切前台、可见性变化、网络恢复、定时器、多标签页信号与 SSE 重连都会触发
 * 重验，且在浏览器里常常同时到达。把它们合并成一个有节流的入口，避免在极短时间内
 * 反复强制刷新 /my-permissions（org + project 两个请求）而触发后端限流。
 * 60 秒定时重验仍远高于该窗口，节流不会削弱既定的刷新时限。
 */
const REVALIDATE_MIN_INTERVAL_MS = 3_000
const revalidate = createRevalidateScheduler(
  () => void runRevalidate(),
  REVALIDATE_MIN_INTERVAL_MS,
)

watch(
  permissionEpoch,
  () => {
    revalidate.trigger()
  },
  { flush: 'post' },
)
window.addEventListener('focus', () => {
  revalidate.trigger()
})
window.addEventListener('online', () => {
  revalidate.trigger()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') revalidate.trigger()
})
setInterval(() => {
  if (document.visibilityState === 'visible') revalidate.trigger()
}, 60_000)
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('beacon-access') : null
let remoteSignal = false
channel?.addEventListener('message', (event) => {
  remoteSignal = true
  if (event.data === 'logout') useUserStore().reset()
  if (event.data === 'invalidate') {
    usePermissionsStore().invalidate()
    revalidate.trigger()
  }
  queueMicrotask(() => {
    remoteSignal = false
  })
})
watch(
  sessionEpoch,
  () => {
    if (!remoteSignal && !useUserStore().isLogin) channel?.postMessage('logout')
  },
  { flush: 'post' },
)
window.addEventListener('beacon-permissions-changed', () => {
  usePermissionsStore().invalidate()
  channel?.postMessage('invalidate')
  revalidate.trigger()
})
window.addEventListener('beacon-permissions-revalidate', () => {
  revalidate.trigger()
})

app.mount('#app')
