import type { RouteRecordRaw } from 'vue-router'

import { HOME_PATH } from '@/config'
import {
  Analytics01Icon,
  DashboardSquare01Icon,
  Folder01Icon,
  InformationCircleIcon,
  Settings01Icon,
  TeamWorkIcon,
} from '@/icons'

// 布局组件懒加载，避免路由表与布局组件互相静态引用
const Layout = () => import('@/layouts/index.vue')
const BlankLayout = () => import('@/layouts/blank.vue')
const PlainLayout = () => import('@/layouts/plain.vue')

/**
 * 主布局下的业务路由，侧边菜单由这份路由表的 meta 生成：
 * 声明顺序即菜单顺序，meta.group 变化处会自动出现分组分隔线。
 */
export const layoutChildren: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: {
      titleKey: 'menu.dashboard',
      icon: DashboardSquare01Icon,
      group: 'main',
      hideHeader: true,
    },
  },
  {
    path: 'team',
    name: 'team',
    component: () => import('@/views/TeamView.vue'),
    meta: { titleKey: 'menu.team', icon: TeamWorkIcon, group: 'main' },
  },
  {
    path: 'project',
    name: 'project',
    component: () => import('@/views/ProjectView.vue'),
    meta: { titleKey: 'menu.project', icon: Folder01Icon, group: 'main' },
  },
  {
    path: 'monitor',
    name: 'monitor',
    component: () => import('@/views/MonitorView.vue'),
    meta: { titleKey: 'menu.monitor', icon: Analytics01Icon, group: 'main' },
  },

  {
    path: 'settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { titleKey: 'menu.settings', icon: Settings01Icon, group: 'system' },
  },

  // 不在菜单中展示的页面
  {
    path: 'about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { titleKey: 'nav.about', icon: InformationCircleIcon, hidden: true },
  },
]

/**
 * 路由表分两类布局：
 * - 主布局（Layout）：带侧边菜单与顶部栏，挂在 '/' 下
 * - 空白布局（BlankLayout）：整屏无框架，用于 404、登录等页面
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'root',
    component: Layout,
    redirect: HOME_PATH,
    children: layoutChildren,
  },
  {
    // 登录页：整屏无框架，自带品牌条与居中卡片
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { titleKey: 'login.title.login', hidden: true },
  },
  {
    // 选择环境：控制台之外的独立整页，只有精简顶栏，不带侧边菜单
    path: '/env',
    component: PlainLayout,
    children: [
      {
        path: '',
        name: 'select-env',
        component: () => import('@/views/EnvView.vue'),
        meta: { titleKey: 'env.title' },
      },
    ],
  },
  {
    // 空白布局示例：/blank 下的页面不带侧边菜单与顶部栏
    path: '/blank',
    component: BlankLayout,
    children: [
      {
        path: '',
        name: 'blank-demo',
        component: () => import('@/views/BlankDemoView.vue'),
        meta: { titleKey: 'nav.blankDemo', hidden: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    component: BlankLayout,
    children: [
      {
        path: '',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { titleKey: 'notFound.title', hidden: true },
      },
    ],
  },
]

export default routes
