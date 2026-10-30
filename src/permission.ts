import router from '@/router'
import { useOrganizationStore, useUserStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { canVisitNavigation, navigationScope } from '@/utils/navigation-access'
import { sessionEpoch } from '@/utils/access-context'

/** 无需登录即可访问的路径 */
const WHITE_LIST = ['/login']

/**
 * 导航门禁的权限新鲜度窗口。
 * 每次导航都强刷组织与项目两份 /my-permissions，会让“点一下菜单”固定产生两次请求；
 * 窗口内复用刚取到的能力即可。失效信号会清空缓存与窗口，仍能立即重取，
 * 且该窗口远小于 60 秒的既定刷新上限。
 */
const ENTRY_REFRESH_MAX_AGE_MS = 5_000

/**
 * 全局路由守卫：
 * - 白名单（登录页）与 meta.public 的路由（如公开状态页 /status/:slug）直接放行
 * - 未登录时跳登录页，并带上来源地址，登录后回跳
 * - 已登录但本地没有用户信息时补拉一次，失败则按登录失效处理
 *
 * 注意：这里通过 useUserStore() 在导航时取 store，此时 pinia 已安装。
 */
router.beforeEach(async (to) => {
  const userStore = useUserStore()
  const session = sessionEpoch.value

  if (WHITE_LIST.includes(to.path) || to.matched.some((record) => record.meta.public)) {
    return true
  }

  if (!userStore.isLogin) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/access-unavailable') return true

  if (!userStore.identityVerified || navigationScope(to.path) === 'platform') {
    try {
      await userStore.loadUser()
    } catch {
      // 令牌失效：请求层已触发登出，这里回到登录页即可
      if (!userStore.isLogin) return { path: '/login', query: { redirect: to.fullPath } }
      return { path: '/access-unavailable' }
    }
  }

  if (session !== sessionEpoch.value) return false
  const scope = navigationScope(to.path)
  if (scope !== 'account' && scope !== 'platform') {
    const org = useOrganizationStore()
    const permissions = usePermissionsStore()
    if (org.workspaceState !== 'ready') await org.loadWorkspace()
    // 邮件与容量通知携带组织提示；先确认访问权再切换，避免使用上次的组织。
    const organizationHint =
      typeof to.query.organizationId === 'string' ? to.query.organizationId : ''
    if (organizationHint && (scope === 'organization' || to.path === '/dashboard')) {
      const hintedAuthority = await permissions.ensureOrganization(
        organizationHint,
        true,
        ENTRY_REFRESH_MAX_AGE_MS,
      )
      if (!hintedAuthority || session !== sessionEpoch.value) return { path: '/access-unavailable' }
      if (organizationHint !== org.currentOrganizationId)
        await org.switchOrganization(organizationHint)
      if (org.currentOrganizationId !== organizationHint) return { path: '/access-unavailable' }
      // 后端容量邮件的处理入口为站点根地址（重定向到 dashboard）。
      if (to.path === '/dashboard')
        return { path: '/billing', query: to.query, hash: '#monitor-capacity' }
    }
    if (!org.currentOrganizationId) return { path: '/team' }
    const authority = await permissions.ensureOrganization(
      org.currentOrganizationId,
      true,
      ENTRY_REFRESH_MAX_AGE_MS,
    )
    if (!authority) return { path: '/access-unavailable' }
    const id = typeof to.params.projectId === 'string' ? to.params.projectId : org.currentProjectId
    if (scope === 'project' && id) {
      const project = await permissions.ensureProject(id, true, ENTRY_REFRESH_MAX_AGE_MS)
      if (!project) return { path: '/access-unavailable' }
      if (project.organizationId !== org.currentOrganizationId) {
        await org.switchOrganization(project.organizationId)
        if (!org.projects.some((item) => item.id === id)) return { path: '/access-unavailable' }
        await org.switchProject(id)
      }
    }
  }
  if (session !== sessionEpoch.value) return false
  return canVisitNavigation(
    to.path,
    typeof to.params.projectId === 'string' ? to.params.projectId : undefined,
  )
    ? true
    : { path: '/access-unavailable' }
})

/** 进入登录页即视为未登录态，清掉本地凭证 */
router.afterEach((to) => {
  if (to.path === '/login') {
    useUserStore().reset()
  }
})
