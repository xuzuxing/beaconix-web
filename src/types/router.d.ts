import 'vue-router'

import type { GlobalRole } from '@/api/types'
import type { IconData } from '@/icons'

import type { MenuBadge } from './index'

/**
 * 路由 meta 约定（布局与菜单依赖这些字段）：
 * - titleKey: 标题的 i18n key，用于面包屑、页面标题与菜单文案
 * - icon: 侧边菜单图标（Hugeicons 图标对象）
 * - group: 一级菜单分组，相邻分组之间会渲染一条分隔线
 * - badge: 菜单项右侧徽标（如 Beta、限时活动）
 * - subTitleKey: 在二级菜单里显示的标题（默认取 titleKey）
 * - subGroup: 二级菜单分组，值即分组标题的 i18n key，变化处渲染分组标签
 * - roles: 只对这些全局角色可见（如平台管理后台仅 SUPER_ADMIN），缺省对所有登录用户可见
 * - hideHeader: 为 true 时不渲染内容区标题栏（页面自带头部，如概览页）
 * - hideRating: 为 true 时不渲染标题栏右侧的评价卡（如监控这类自带工具栏的页面）
 * - hidden: 为 true 时不出现在菜单里
 * - keepAlive: 为 false 时该页面不参与 keep-alive 缓存（默认缓存）
 */
declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: string
    icon?: IconData
    group?: string
    badge?: MenuBadge
    subTitleKey?: string
    subGroup?: string
    roles?: readonly GlobalRole[]
    hideHeader?: boolean
    hidden?: boolean
    menuExcluded?: boolean
    activeMenu?: string
    keepAlive?: boolean
  }
}
