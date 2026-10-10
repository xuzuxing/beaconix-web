import type { RouteRecordRaw } from 'vue-router'

import { HOME_PATH } from '@/config'
import {
  AiBrain01Icon,
  AiMagicIcon,
  Analytics01Icon,
  BlocksIcon,
  CloudIcon,
  DashboardSquare01Icon,
  Database01Icon,
  Folder01Icon,
  GlobalIcon,
  InformationCircleIcon,
  Invoice01Icon,
  Link01Icon,
  PuzzleIcon,
  SecurityCheckIcon,
} from '@/icons'

// 布局组件懒加载，避免路由表与布局组件互相静态引用
const Layout = () => import('@/layouts/index.vue')
const BlankLayout = () => import('@/layouts/blank.vue')
const PlainLayout = () => import('@/layouts/plain.vue')

/** 尚未实现的功能页统一指向占位页 */
const Placeholder = () => import('@/views/PlaceholderView.vue')

/**
 * 主布局下的业务路由，侧边菜单由这份路由表的 meta 生成：
 * 声明顺序即菜单顺序，meta.group 变化处会自动出现分组分隔线。
 */
export const layoutChildren: RouteRecordRaw[] = [
  {
    path: 'overview',
    name: 'overview',
    component: () => import('@/views/OverviewView.vue'),
    meta: {
      titleKey: 'menu.overview',
      icon: DashboardSquare01Icon,
      group: 'main',
      hideHeader: true,
    },
  },
  {
    path: 'integration',
    name: 'integration',
    component: Placeholder,
    meta: { titleKey: 'menu.integration', icon: BlocksIcon, group: 'main' },
  },
  {
    path: 'agent',
    name: 'agent',
    component: Placeholder,
    meta: {
      titleKey: 'menu.agent',
      icon: AiBrain01Icon,
      group: 'main',
      badge: { textKey: 'badge.beta', theme: 'primary' },
    },
  },

  {
    path: 'db',
    name: 'db',
    component: Placeholder,
    meta: { titleKey: 'menu.db', icon: Database01Icon, group: 'service' },
  },
  {
    path: 'functions',
    name: 'functions',
    component: Placeholder,
    meta: { titleKey: 'menu.functions', icon: CloudIcon, group: 'service' },
  },
  {
    // 云存储：带二级菜单，子路由的 subGroup 决定二级菜单里的分组
    path: 'storage',
    name: 'storage',
    component: Placeholder,
    meta: {
      titleKey: 'menu.storage',
      subTitleKey: 'submenu.storage.manage',
      icon: Folder01Icon,
      group: 'service',
      subGroup: 'submenu.storage.overview',
    },
  },
  {
    path: 'storage/permission',
    name: 'storage-permission',
    component: Placeholder,
    meta: { titleKey: 'submenu.storage.permission', subGroup: 'submenu.storage.overview' },
  },
  {
    path: 'storage/customize-cdn',
    name: 'storage-cdn',
    component: Placeholder,
    meta: { titleKey: 'submenu.storage.cdn', subGroup: 'submenu.storage.overview' },
  },
  {
    path: 'storage/ci',
    name: 'storage-ci',
    component: Placeholder,
    meta: { titleKey: 'submenu.storage.ci', subGroup: 'submenu.storage.advanced' },
  },
  {
    path: 'storage/audit',
    name: 'storage-audit',
    component: Placeholder,
    meta: { titleKey: 'submenu.storage.audit', subGroup: 'submenu.storage.advanced' },
  },
  {
    path: 'storage/meta-insight',
    name: 'storage-insight',
    component: Placeholder,
    meta: { titleKey: 'submenu.storage.insight', subGroup: 'submenu.storage.advanced' },
  },
  {
    path: 'ai',
    name: 'ai',
    component: Placeholder,
    meta: { titleKey: 'menu.ai', icon: AiMagicIcon, group: 'service' },
  },
  {
    path: 'static-hosting',
    name: 'static-hosting',
    component: Placeholder,
    meta: { titleKey: 'menu.staticHosting', icon: GlobalIcon, group: 'service' },
  },

  {
    path: 'identity',
    name: 'identity',
    component: Placeholder,
    meta: { titleKey: 'menu.identity', icon: SecurityCheckIcon, group: 'gateway' },
  },
  {
    path: 'http-gateway',
    name: 'http-gateway',
    component: Placeholder,
    meta: { titleKey: 'menu.httpGateway', icon: Link01Icon, group: 'gateway' },
  },

  {
    path: 'logs',
    name: 'logs',
    component: Placeholder,
    meta: { titleKey: 'menu.logs', icon: Analytics01Icon, group: 'ops' },
  },
  {
    path: 'extensions',
    name: 'extensions',
    component: Placeholder,
    meta: { titleKey: 'menu.extensions', icon: PuzzleIcon, group: 'ops' },
  },
  {
    path: 'usage',
    name: 'usage',
    component: () => import('@/views/UsageView.vue'),
    meta: {
      titleKey: 'menu.usage',
      icon: Invoice01Icon,
      group: 'ops',
      badge: { textKey: 'badge.limited', theme: 'warning' },
      // 页内 Tab 与快捷链接通过 Teleport 注入布局标题栏，不参与 keep-alive 缓存
      keepAlive: false,
    },
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
