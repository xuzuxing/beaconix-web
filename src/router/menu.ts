import type { RouteRecordRaw } from 'vue-router'

import type { MenuItem } from '@/types'

/** 拼接父子路由的完整路径 */
function resolvePath(basePath: string, path: string): string {
  if (path.startsWith('/')) {
    return path
  }
  const base = basePath.replace(/\/+$/, '')
  const full = `${base}/${path}`.replace(/\/+$/, '')
  return full || '/'
}

/**
 * 把路由表转成菜单树，菜单顺序即路由声明顺序。
 * - 一级菜单：路径只含一段的路由；meta.group 变化处插入分组分隔线
 * - 二级菜单：路径含多段的路由按第一段归到对应的一级项；meta.subGroup 变化处插入分组标签
 * - 一级项自身也会作为二级菜单的第一项（文案取 meta.subTitleKey），
 *   因此只有真正带子路由的模块才会出现二级菜单
 */
export function buildMenu(routes: readonly RouteRecordRaw[], basePath = ''): MenuItem[] {
  const items: MenuItem[] = []
  const submenus = new Map<string, MenuItem[]>()
  /** 每个一级模块当前所在的二级分组，用于避免重复渲染分组标签 */
  const subGroups = new Map<string, string | undefined>()
  let currentGroup: string | undefined

  const pushSub = (parentPath: string, sub: MenuItem, subGroup?: string) => {
    const list = submenus.get(parentPath) ?? []
    if (subGroup && subGroups.get(parentPath) !== subGroup) {
      list.push({ path: `group:${subGroup}`, type: 'group', titleKey: subGroup })
      subGroups.set(parentPath, subGroup)
    }
    list.push(sub)
    submenus.set(parentPath, list)
  }

  routes.forEach((route) => {
    if (route.meta?.hidden) {
      return
    }

    const path = resolvePath(basePath, route.path)
    const segments = route.path.split('/').filter(Boolean)

    // 二级项：归到第一段对应的一级项
    if (segments.length > 1) {
      const [head] = segments
      if (!head) {
        return
      }
      pushSub(
        resolvePath(basePath, head),
        {
          path,
          titleKey: route.meta?.titleKey,
          icon: route.meta?.icon,
          badge: route.meta?.badge,
        },
        route.meta?.subGroup,
      )
      return
    }

    const group = route.meta?.group
    if (group && currentGroup !== undefined && group !== currentGroup) {
      items.push({ path: `divider:${group}`, type: 'divider' })
    }
    if (group) {
      currentGroup = group
    }

    items.push({
      path,
      titleKey: route.meta?.titleKey,
      icon: route.meta?.icon,
      badge: route.meta?.badge,
    })

    // 一级项自身作为二级菜单的第一项（有子路由时才会真正显示二级菜单）
    if (route.meta?.titleKey) {
      pushSub(
        path,
        { path, titleKey: route.meta.subTitleKey ?? route.meta.titleKey },
        route.meta.subGroup,
      )
    }
  })

  // 只有一个「自身」项时不渲染二级菜单
  items.forEach((item) => {
    const submenu = submenus.get(item.path)
    if (submenu && submenu.filter((sub) => sub.type !== 'group').length > 1) {
      item.submenu = submenu
    }
  })

  return items
}
