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
    if (status === 403) void revalidate()
  },
})

let checking: Promise<void> | undefined
async function revalidate() {
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
      await org.loadWorkspace(true)
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
watch(
  permissionEpoch,
  () => {
    void revalidate()
  },
  { flush: 'post' },
)
window.addEventListener('focus', () => {
  void revalidate()
})
window.addEventListener('online', () => {
  void revalidate()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void revalidate()
})
setInterval(() => {
  if (document.visibilityState === 'visible') void revalidate()
}, 60_000)
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('beacon-access') : null
let remoteSignal = false
channel?.addEventListener('message', (event) => {
  remoteSignal = true
  if (event.data === 'logout') useUserStore().reset()
  if (event.data === 'invalidate') {
    usePermissionsStore().invalidate()
    void revalidate()
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
  void revalidate()
})
window.addEventListener('beacon-permissions-revalidate', () => {
  void revalidate()
})

app.mount('#app')
