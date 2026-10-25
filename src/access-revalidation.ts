import { watch } from 'vue'

import router from '@/router'
import { useOrganizationStore, useUserStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { permissionEpoch, sessionEpoch } from '@/utils/access-context'
import { canVisitNavigation, navigationScope } from '@/utils/navigation-access'
import { createRevalidateScheduler } from '@/utils/revalidate-schedule'

/**
 * 应用级「主动重验」入口，与 permission.ts（路由守卫）互补：
 * 守卫只在导航时判定，这里处理登录态下的后台变化——切回前台、网络恢复、前台定时、
 * 多标签页失效信号与会话切换。
 *
 * 所有触发都先经 createRevalidateScheduler 合并，避免在极短时间内反复强制刷新
 * /my-permissions（org + project 两个请求）而触发后端限流。
 * 60 秒定时重验仍远高于该窗口，节流不会削弱既定的刷新时限。
 */
const REVALIDATE_MIN_INTERVAL_MS = 3_000

let scheduler: ReturnType<typeof createRevalidateScheduler> | undefined
let checking: Promise<void> | undefined

/** 触发一次重验（经节流合并） */
export function requestRevalidation() {
  scheduler?.trigger()
}

/** 当前作用域内的 403：交给重验去核对最新能力，不在这里直接判定失权 */
export function handleAccessDenied(status: number, path: string) {
  if (path.endsWith('/my-permissions')) return
  const org = useOrganizationStore()
  const currentScope =
    path.includes(`/organizations/${org.currentOrganizationId}/`) ||
    path.includes(`/projects/${org.currentProjectId}/`)
  if (!currentScope) return
  if (status === 403) requestRevalidation()
}

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

/** 在应用装配阶段调用一次，注册全部重验触发源 */
export function setupAccessRevalidation() {
  scheduler = createRevalidateScheduler(() => void runRevalidate(), REVALIDATE_MIN_INTERVAL_MS)

  watch(permissionEpoch, requestRevalidation, { flush: 'post' })
  window.addEventListener('focus', requestRevalidation)
  window.addEventListener('online', requestRevalidation)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestRevalidation()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') requestRevalidation()
  }, 60_000)

  const channel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('beacon-access') : null
  let remoteSignal = false
  channel?.addEventListener('message', (event) => {
    remoteSignal = true
    if (event.data === 'logout') useUserStore().reset()
    if (event.data === 'invalidate') {
      usePermissionsStore().invalidate()
      requestRevalidation()
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
    requestRevalidation()
  })
  window.addEventListener('beacon-permissions-revalidate', requestRevalidation)
}
