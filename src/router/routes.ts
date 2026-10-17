import type { RouteRecordRaw } from 'vue-router'

import type { GlobalRole } from '@/api/types'
import { HOME_PATH } from '@/config'
import {
  Analytics01Icon,
  ApiIcon,
  CustomerServiceIcon,
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
 * - 页面组件按业务域分目录放在 `src/views/<domain>/`（dashboard / monitor / channels /
 *   rules / billing / team / account / auth / common），新增页面时放进对应域
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
    component: () => import('@/views/dashboard/DashboardView.vue'),
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
    component: () => import('@/views/monitor/MonitorOverviewView.vue'),
    meta: { titleKey: 'submenu.monitor.overview', group: 'main' },
  },
  {
    path: 'monitor',
    name: 'monitor',
    component: () => import('@/views/monitor/MonitorView.vue'),
    meta: {
      titleKey: 'menu.monitor',
      subTitleKey: 'submenu.monitor.manage',
      icon: Analytics01Icon,
      group: 'main',
      keepAlive: false,
    },
  },
  {
    path: 'monitor/:projectId/:monitorId',
    name: 'monitor-detail',
    component: () => import('@/views/monitor/MonitorDetailView.vue'),
    meta: {
      // 标题由页面用 usePageHeader 覆盖为监控项名称，这里只作为兜底文案
      titleKey: 'monitorPage.detail',
      hidden: true,
      menuExcluded: true,
      activeMenu: '/monitor',
      keepAlive: false,
    },
  },
  {
    // 文案沿用「检测异常条件」，路径与后端资源 rule-groups 对齐
    path: 'monitor/rule-groups',
    name: 'monitor-rule-groups',
    component: () => import('@/views/rules/RuleGroupsView.vue'),
    meta: { titleKey: 'submenu.monitor.alertRules', group: 'main' },
  },

  // ---------- 探针节点 ----------
  {
    path: 'probes/overview',
    name: 'probes-overview',
    component: () => import('@/views/probes/ProbesOverviewView.vue'),
    meta: { titleKey: 'submenu.probes.overview', group: 'main', keepAlive: false },
  },
  {
    path: 'probes',
    name: 'probes',
    component: () => import('@/views/probes/ProbesView.vue'),
    meta: {
      titleKey: 'menu.probes',
      subTitleKey: 'submenu.probes.nodes',
      icon: ServerIcon,
      group: 'main',
      keepAlive: false,
    },
  },

  // ---------- 通知渠道 ----------
  {
    path: 'channels/overview',
    name: 'channels-overview',
    component: () => import('@/views/channels/ChannelsOverviewView.vue'),
    meta: { titleKey: 'submenu.channels.overview', group: 'main' },
  },
  {
    path: 'channels',
    name: 'channels',
    component: () => import('@/views/channels/ChannelsView.vue'),
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
    component: () => import('@/views/status-pages/StatusPagesOverviewView.vue'),
    meta: { titleKey: 'submenu.statusPages.overview', group: 'main' },
  },
  {
    path: 'status-pages',
    name: 'status-pages',
    component: () => import('@/views/status-pages/StatusPagesView.vue'),
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
    component: () => import('@/views/status-pages/StatusPageTemplatesView.vue'),
    meta: { titleKey: 'submenu.statusPages.templates', group: 'main' },
  },

  // ---------- 账单 ----------
  {
    path: 'billing',
    name: 'billing',
    component: () => import('@/views/billing/UsageView.vue'),
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
    component: () => import('@/views/billing/OrdersView.vue'),
    meta: { titleKey: 'submenu.billing.orders', group: 'main' },
  },

  // ---------- 团队管理（隐藏：顶栏左侧团队下拉入口）----------
  {
    path: 'teams',
    name: 'teams',
    component: () => import('@/views/team/TeamInfoView.vue'),
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
    component: () => import('@/views/team/TeamMembersView.vue'),
    meta: { titleKey: 'submenu.team.members', group: 'main', hidden: true },
  },
  {
    path: 'teams/api-keys',
    name: 'team-api-keys',
    component: () => import('@/views/team/TeamApiKeysView.vue'),
    meta: { titleKey: 'submenu.team.apiKeys', group: 'main', hidden: true },
  },
  {
    path: 'teams/audit-logs',
    name: 'team-audit-logs',
    component: () => import('@/views/team/TeamAuditLogsView.vue'),
    meta: { titleKey: 'submenu.team.auditLogs', group: 'main', hidden: true },
  },

  // ---------- 个人 / 消息通知（隐藏：顶栏右侧用户下拉入口）----------
  {
    path: 'profile',
    name: 'profile',
    component: () => import('@/views/account/ProfileView.vue'),
    meta: { titleKey: 'menu.profile', icon: UserCircleIcon, group: 'main', hidden: true },
  },
  {
    path: 'security',
    name: 'security',
    component: () => import('@/views/account/SecurityView.vue'),
    meta: { titleKey: 'menu.security', icon: LockPasswordIcon, group: 'main', hidden: true },
  },
  {
    path: 'access-tokens',
    name: 'access-tokens',
    component: () => import('@/views/account/AccessTokensView.vue'),
    meta: { titleKey: 'menu.accessTokens', icon: ApiIcon, group: 'main', hidden: true },
  },
  {
    path: 'notifications',
    name: 'notifications',
    component: () => import('@/views/notifications/NotificationListView.vue'),
    meta: { titleKey: 'menu.notifications', icon: Notification03Icon, group: 'main', hidden: true },
  },
  {
    // 事项详情：后端没有单条查询接口，页面按 id 从列表回捞
    path: 'notifications/:id',
    name: 'notification-detail',
    component: () => import('@/views/notifications/NotificationDetailView.vue'),
    meta: {
      titleKey: 'notificationCenter.detailTitle',
      hidden: true,
      menuExcluded: true,
      activeMenu: '/notifications',
    },
  },

  // ---------- 工单（隐藏：顶栏头像下拉的「我的工单」入口）----------
  {
    path: 'tickets',
    name: 'tickets',
    component: () => import('@/views/support/MyTicketsView.vue'),
    meta: { titleKey: 'menu.tickets', icon: CustomerServiceIcon, group: 'main', hidden: true },
  },
  {
    path: 'tickets/:id',
    name: 'ticket-detail',
    component: () => import('@/views/support/TicketDetailView.vue'),
    meta: {
      titleKey: 'ticketPage.detailTitle',
      hidden: true,
      menuExcluded: true,
      activeMenu: '/tickets',
    },
  },

  // ---------- 管理后台（仅 SUPER_ADMIN，独立分组）----------
  {
    path: 'admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminMetricsView.vue'),
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
    component: () => import('@/views/admin/AdminTenantsView.vue'),
    meta: { titleKey: 'submenu.admin.tenants', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    path: 'admin/system-probes',
    name: 'admin-system-probes',
    component: () => import('@/views/admin/AdminSystemProbesView.vue'),
    meta: { titleKey: 'submenu.admin.probes', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    path: 'admin/audit-logs',
    name: 'admin-audit-logs',
    component: () => import('@/views/admin/AdminAuditLogsView.vue'),
    meta: { titleKey: 'submenu.admin.auditLogs', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    // 跨租户订单：与「账单 → 订单管理」（单组织维度）不同，这里覆盖全平台
    path: 'admin/orders',
    name: 'admin-orders',
    component: () => import('@/views/admin/AdminOrdersView.vue'),
    meta: { titleKey: 'submenu.admin.orders', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    // 跨账号工单：用户侧入口在顶栏「我的工单」，这里做全平台处理
    path: 'admin/tickets',
    name: 'admin-tickets',
    component: () => import('@/views/admin/AdminTicketsView.vue'),
    meta: { titleKey: 'submenu.admin.tickets', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    // 工单分类：提交工单时的下拉数据源，停用后只保留在历史工单上
    path: 'admin/ticket-categories',
    name: 'admin-ticket-categories',
    component: () => import('@/views/admin/AdminTicketCategoriesView.vue'),
    meta: { titleKey: 'submenu.admin.ticketCategories', group: 'admin', roles: ADMIN_ROLES },
  },
  {
    // 平台级运行时配置：顶部 tab 的分组清单与顺序由 develop.configGroup 决定
    path: 'admin/settings',
    name: 'admin-settings',
    component: () => import('@/views/admin/AdminSettingsView.vue'),
    meta: { titleKey: 'submenu.admin.settings', group: 'admin', roles: ADMIN_ROLES },
  },

  // ---------- 不在菜单中展示 ----------
  {
    path: 'about',
    name: 'about',
    component: () => import('@/views/common/AboutView.vue'),
    meta: {
      titleKey: 'nav.about',
      icon: InformationCircleIcon,
      hidden: true,
      searchExcluded: true,
    },
  },
]

/**
 * 路由表分两类布局：
 * - 主布局（Layout）：带侧边菜单与顶部栏，挂在 '/' 下
 * - 空白布局（BlankLayout）：整屏无框架，用于 404、登录等页面
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/invitations/:token',
    component: () => import('@/views/auth/InvitationView.vue'),
    meta: { public: true, hidden: true },
  },
  {
    path: '/access-unavailable',
    component: PlainLayout,
    children: [{ path: '', component: () => import('@/views/common/AccessUnavailableView.vue') }],
  },
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
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { titleKey: 'login.title.login', hidden: true },
  },
  {
    // 公开状态页：对外分享的地址，无需登录，整屏无框架（数据来自 GET /status/:slug）
    path: '/status',
    component: BlankLayout,
    children: [
      {
        path: ':slug',
        name: 'public-status-page',
        component: () => import('@/views/status-pages/PublicStatusPageView.vue'),
        meta: { titleKey: 'menu.statusPages', public: true, hidden: true },
      },
    ],
  },
  {
    // 服务条款：公开页面，无需登录，登录页协议链接跳转到这里
    path: '/terms',
    component: BlankLayout,
    children: [
      {
        path: '',
        name: 'terms',
        component: () => import('@/views/common/TermsView.vue'),
        meta: { titleKey: 'legal.terms.title', public: true, hidden: true },
      },
    ],
  },
  {
    // 隐私政策：公开页面，无需登录，登录页协议链接跳转到这里
    path: '/privacy',
    component: BlankLayout,
    children: [
      {
        path: '',
        name: 'privacy',
        component: () => import('@/views/common/PrivacyView.vue'),
        meta: { titleKey: 'legal.privacy.title', public: true, hidden: true },
      },
    ],
  },
  {
    // 安装后的设备授权确认：与团队选择页共用精简顶栏。
    path: '/activate',
    component: PlainLayout,
    children: [
      {
        path: '',
        name: 'probe-activate',
        component: () => import('@/views/probes/ProbeActivateView.vue'),
        meta: { titleKey: 'probePage.activation.title', hidden: true },
      },
    ],
  },
  {
    // 选择团队：控制台之外的独立整页，只有精简顶栏，不带侧边菜单
    path: '/team',
    component: PlainLayout,
    children: [
      {
        path: '',
        name: 'select-team',
        component: () => import('@/views/team/TeamSelectView.vue'),
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
        component: () => import('@/views/common/BlankDemoView.vue'),
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
        component: () => import('@/views/common/NotFoundView.vue'),
        meta: { titleKey: 'notFound.title', hidden: true },
      },
    ],
  },
]

export default routes
