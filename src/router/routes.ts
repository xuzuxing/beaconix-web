import type { RouteRecordRaw } from 'vue-router'

import type { GlobalRole } from '@/api/types'
import { HOME_PATH } from '@/config'
import {
  Analytics01Icon,
  ApiIcon,
  DashboardSquare01Icon,
  GlobalIcon,
  InformationCircleIcon,
  Invoice01Icon,
  LockPasswordIcon,
  Notification03Icon,
  ServerIcon,
  Settings01Icon,
  TeamWorkIcon,
  UserCircleIcon,
} from '@/icons'

// 布局组件懒加载，避免路由表与布局组件互相静态引用
const Layout = () => import('@/layouts/index.vue')
const BlankLayout = () => import('@/layouts/blank.vue')
const PlainLayout = () => import('@/layouts/plain.vue')

/** 平台管理后台的可见角色（其它角色既看不到菜单，也进不到这些页面） */
const ADMIN_ROLES: GlobalRole[] = ['SUPER_ADMIN']

/**
 * 主布局下的业务路由，侧边菜单由这份路由表的 meta 生成。
 *
 * 约定：
 * - 菜单顺序即路由声明顺序；一级项 = 单段路径的路由，多段路径归到它第一段对应的一级项下
 * - 二级菜单里「一级项自身」的位置同样由声明顺序决定（它取 meta.subTitleKey 作为文案），
 *   所以把 xxx/overview 写在 xxx 之前，「概览」就会排在「管理」前面
 * - meta.group 变化处插入分组分隔线：主区所有页面同属 main，只有「管理后台」另起一组
 * - meta.hidden 的模块不进侧边栏（团队管理 / 个人 / 消息通知），由顶栏下拉进入；
 *   进入这类模块时左侧仍会渲染它的子页导航（见 layouts/components/SecondaryNav.vue）
 */
export const layoutChildren: RouteRecordRaw[] = [
  // ---------- 概览 ----------
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

  // ---------- 云监控 ----------
  {
    path: 'monitor/overview',
    name: 'monitor-overview',
    component: () => import('@/views/MonitorOverviewView.vue'),
    meta: { titleKey: 'submenu.monitor.overview', group: 'main' },
  },
  {
    path: 'monitor',
    name: 'monitor',
    component: () => import('@/views/MonitorView.vue'),
    meta: {
      titleKey: 'menu.monitor',
      subTitleKey: 'submenu.monitor.manage',
      icon: Analytics01Icon,
      group: 'main',
      hideRating: true,
      keepAlive: false,
    },
  },
  {
    path: 'monitor/:projectId/:monitorId',
    name: 'monitor-detail',
    component: () => import('@/views/MonitorDetailView.vue'),
    meta: {
      // 标题由页面用 usePageHeader 覆盖为监控项名称，这里只作为兜底文案
      titleKey: 'monitorPage.detail',
      hidden: true,
      menuExcluded: true,
      activeMenu: '/monitor',
      hideRating: true,
      keepAlive: false,
    },
  },
  {
    // 文案沿用「告警规则」，路径与后端资源 rule-groups 对齐
    path: 'monitor/rule-groups',
    name: 'monitor-rule-groups',
    component: () => import('@/views/RuleGroupsView.vue'),
    meta: { titleKey: 'submenu.monitor.alertRules', group: 'main' },
  },

  // ---------- 探针节点 ----------
  {
    path: 'probes/overview',
    name: 'probes-overview',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.probes.overview', group: 'main' },
  },
  {
    path: 'probes',
    name: 'probes',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: {
      titleKey: 'menu.probes',
      subTitleKey: 'submenu.probes.nodes',
      icon: ServerIcon,
      group: 'main',
    },
  },

  // ---------- 通知渠道 ----------
  {
    path: 'channels/overview',
    name: 'channels-overview',
    component: () => import('@/views/ChannelsOverviewView.vue'),
    meta: { titleKey: 'submenu.channels.overview', group: 'main' },
  },
  {
    path: 'channels',
    name: 'channels',
    component: () => import('@/views/ChannelsView.vue'),
    meta: {
      titleKey: 'menu.channels',
      subTitleKey: 'submenu.channels.manage',
      icon: Notification03Icon,
      group: 'main',
    },
  },

  // ---------- 状态页 ----------
  {
    path: 'status-pages/overview',
    name: 'status-pages-overview',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.statusPages.overview', group: 'main' },
  },
  {
    path: 'status-pages',
    name: 'status-pages',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: {
      titleKey: 'menu.statusPages',
      subTitleKey: 'submenu.statusPages.pages',
      icon: GlobalIcon,
      group: 'main',
    },
  },
  {
    path: 'status-pages/templates',
    name: 'status-pages-templates',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.statusPages.templates', group: 'main' },
  },

  // ---------- 账单 ----------
  {
    path: 'billing',
    name: 'billing',
    component: () => import('@/views/UsageView.vue'),
    meta: {
      titleKey: 'menu.billing',
      subTitleKey: 'submenu.billing.usage',
      icon: Invoice01Icon,
      group: 'main',
    },
  },
  {
    path: 'billing/orders',
    name: 'billing-orders',
    component: () => import('@/views/OrdersView.vue'),
    meta: { titleKey: 'submenu.billing.orders', group: 'main' },
  },

  // ---------- 团队管理（隐藏：顶栏左侧团队下拉入口）----------
  {
    path: 'teams',
    name: 'teams',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: {
      titleKey: 'menu.team',
      subTitleKey: 'submenu.team.basic',
      icon: TeamWorkIcon,
      group: 'main',
      hidden: true,
    },
  },
  {
    path: 'teams/members',
    name: 'team-members',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.team.members', group: 'main', hidden: true },
  },
  {
    path: 'teams/api-keys',
    name: 'team-api-keys',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.team.apiKeys', group: 'main', hidden: true },
  },
  {
    path: 'teams/audit-logs',
    name: 'team-audit-logs',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.team.auditLogs', group: 'main', hidden: true },
  },

  // ---------- 个人 / 消息通知（隐藏：顶栏右侧用户下拉入口）----------
  {
    path: 'profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { titleKey: 'menu.profile', icon: UserCircleIcon, group: 'main', hidden: true },
  },
  {
    path: 'security',
    name: 'security',
    component: () => import('@/views/SecurityView.vue'),
    meta: { titleKey: 'menu.security', icon: LockPasswordIcon, group: 'main', hidden: true },
  },
  {
    path: 'access-tokens',
    name: 'access-tokens',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'menu.accessTokens', icon: ApiIcon, group: 'main', hidden: true },
  },
  {
    path: 'notifications',
    name: 'notifications',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'menu.notifications', icon: Notification03Icon, group: 'main', hidden: true },
  },

  // ---------- 管理后台（仅 SUPER_ADMIN，独立分组）----------
  {
    path: 'admin',
    name: 'admin',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: {
      titleKey: 'menu.admin',
      subTitleKey: 'submenu.admin.metrics',
      icon: Settings01Icon,
      group: 'admin',
      roles: ADMIN_ROLES,
    },
  },
  {
    path: 'admin/tenants',
    name: 'admin-tenants',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.admin.tenants', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    path: 'admin/system-probes',
    name: 'admin-system-probes',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.admin.probes', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    path: 'admin/audit-logs',
    name: 'admin-audit-logs',
    component: () => import('@/views/PlaceholderView.vue'),
    meta: { titleKey: 'submenu.admin.auditLogs', group: 'admin', roles: ADMIN_ROLES },
  },

  // ---------- 不在菜单中展示 ----------
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
    // 选择团队：控制台之外的独立整页，只有精简顶栏，不带侧边菜单
    path: '/team',
    component: PlainLayout,
    children: [
      {
        path: '',
        name: 'select-team',
        component: () => import('@/views/TeamSelectView.vue'),
        meta: { titleKey: 'workspace.teamSelect.title' },
      },
    ],
  },
  {
    // 旧路径兼容：原先的「选择环境」整页已变更为「选择团队」
    path: '/env',
    redirect: '/team',
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
