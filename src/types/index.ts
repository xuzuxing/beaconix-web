import type { IconData } from '@/icons'

/** 语言类型，全项目共用 */
export type LocaleType = 'zh-CN' | 'en-US'

/** 主题模式：浅色 / 深色 / 跟随系统 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/** 菜单项上的徽标（如 Beta、限时活动） */
export interface MenuBadge {
  /** 直接给出的文字，与 textKey 二选一 */
  text?: string
  /** 文字的国际化 key */
  textKey?: string
  theme?: 'default' | 'primary' | 'warning' | 'danger' | 'success'
}

/** 侧边菜单项，由路由表生成（见 src/router/menu.ts） */
export interface MenuItem {
  /** 完整路径，同时作为菜单选中标识；分隔线与分组项用占位 key */
  path: string
  /** menu 渲染为菜单项，divider 渲染为分组分隔线，group 渲染为二级菜单的分组标签 */
  type?: 'menu' | 'divider' | 'group'
  /** 标题的国际化 key */
  titleKey?: string
  /** Hugeicons 图标 */
  icon?: IconData
  /** 标题右侧徽标 */
  badge?: MenuBadge
  /** 二级菜单项（一级菜单项下有子路由时生成） */
  submenu?: MenuItem[]
  children?: MenuItem[]
}
