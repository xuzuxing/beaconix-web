import { layoutChildren } from '@/router/routes'
import type { FeatureSource } from '@/utils/feature-search'

/**
 * 功能搜索的数据源：把路由表拍平成功能源。
 *
 * 拍平后交给 utils/feature-search.ts 的 buildFeatureEntries 整理
 * （模块自身在前、子页取其图标与分类、按 meta.roles 过滤），
 * 因此这里只做字段搬运，不掺业务判断。
 */
export const featureSearchSources: FeatureSource[] = layoutChildren.map((route) => ({
  path: route.path.startsWith('/') ? route.path : `/${route.path}`,
  titleKey: route.meta?.titleKey,
  aliasKeys: route.meta?.subTitleKey ? [route.meta.subTitleKey] : [],
  icon: route.meta?.icon,
  roles: route.meta?.roles,
  menuExcluded: route.meta?.menuExcluded,
  searchExcluded: route.meta?.searchExcluded,
}))
