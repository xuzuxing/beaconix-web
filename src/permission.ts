import router from '@/router'
import { useUserStore } from '@/stores'

/** 无需登录即可访问的路径 */
const WHITE_LIST = ['/login']

/**
 * 全局路由守卫：
 * - 白名单（登录页）直接放行
 * - 未登录时跳登录页，并带上来源地址，登录后回跳
 * - 已登录但本地没有用户信息时补拉一次，失败则按登录失效处理
 *
 * 注意：这里通过 useUserStore() 在导航时取 store，此时 pinia 已安装。
 */
router.beforeEach(async (to) => {
  const userStore = useUserStore()

  if (WHITE_LIST.includes(to.path)) {
    return true
  }

  if (!userStore.token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!userStore.userInfo) {
    try {
      await userStore.loadUserInfo()
    } catch {
      userStore.reset()
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  return true
})

/** 进入登录页即视为未登录态，清掉本地凭证 */
router.afterEach((to) => {
  if (to.path === '/login') {
    useUserStore().reset()
  }
})
