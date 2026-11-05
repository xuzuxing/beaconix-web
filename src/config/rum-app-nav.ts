/**
 * RUM 应用工作台（/rum/:projectId/:appId/*）的页内导航定义。
 *
 * 这些页面带动态路由参数，无法由 `router/menu.ts` 从路由表静态生成菜单项，
 * 因此集中在这里声明，供三处共用：
 * - `router/routes.ts`：展开成 `rum/:projectId/:appId/:section` 子路由
 * - `layouts/components/SecondaryNav.vue`：进入应用后替换成应用内导航
 * - `views/rum/RumAppDetailView.vue`：按 section 渲染对应区块
 *
 * 顺序即导航顺序，`group` 变化处插入分组标签。
 */

export const RUM_APP_SECTIONS = [
  'overview',
  'errors',
  'performance',
  'replays',
  'releases',
  'events',
  'alerts',
  'source-maps',
  'setup',
  'settings',
] as const

export type RumAppSection = (typeof RUM_APP_SECTIONS)[number]

/** 进入应用后的默认页：错误排查是最高频动作 */
export const RUM_APP_DEFAULT_SECTION: RumAppSection = 'errors'

/** 不需要 `rum.read` 即可查看的页面（与改版前的页签权限保持一致） */
export const RUM_APP_MANAGE_ONLY_SECTIONS: readonly RumAppSection[] = [
  'source-maps',
  'setup',
  'settings',
]

export interface RumAppNavItem {
  section: RumAppSection
  /** i18n key，文案与侧边栏项目级菜单保持同一套名词 */
  titleKey: string
  /** 分组标签的 i18n key，同组只渲染一次 */
  groupKey?: string
}

export const RUM_APP_NAV: readonly RumAppNavItem[] = [
  { section: 'overview', titleKey: 'rum.overview' },
  { section: 'errors', titleKey: 'rum.errors' },
  { section: 'performance', titleKey: 'rum.performance' },
  { section: 'replays', titleKey: 'rum.replays' },
  { section: 'releases', titleKey: 'rum.releases', groupKey: 'rum.navGroupRelease' },
  { section: 'events', titleKey: 'rum.events' },
  { section: 'alerts', titleKey: 'rum.alerts', groupKey: 'rum.navGroupConfig' },
  { section: 'source-maps', titleKey: 'rum.maps' },
  { section: 'setup', titleKey: 'rum.setup' },
  { section: 'settings', titleKey: 'rum.appSettings' },
]

/** 改版前用 `?tab=` 表示页签，保留映射让旧链接继续可用 */
export const RUM_APP_TAB_ALIASES: Readonly<Record<string, RumAppSection>> = {
  overview: 'overview',
  performance: 'performance',
  'error-overview': 'errors',
  errors: 'errors',
  releases: 'releases',
  events: 'events',
  replays: 'replays',
  'source-maps': 'source-maps',
  alerts: 'alerts',
  setup: 'setup',
  settings: 'settings',
}

export function isRumAppSection(value: unknown): value is RumAppSection {
  return (
    typeof value === 'string' &&
    (RUM_APP_SECTIONS as readonly string[]).includes(value)
  )
}

/** 把任意输入（含旧 tab 值）归一到一个合法 section */
export function normalizeRumAppSection(value: unknown): RumAppSection {
  if (isRumAppSection(value)) return value
  if (typeof value === 'string') return RUM_APP_TAB_ALIASES[value] ?? RUM_APP_DEFAULT_SECTION
  return RUM_APP_DEFAULT_SECTION
}
