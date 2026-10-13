import type { GlobalRole } from '@/api/types'
import type { IconData } from '@/icons'
import { canVisitNavigation } from './navigation-access'

/**
 * 顶栏全局搜索的纯逻辑层：把路由 meta 归一化后的「功能源」整理成功能入口列表，
 * 再按关键词过滤并计算高亮分段。
 *
 * 这里刻意不依赖路由表与 i18n 实例（文案通过 translate 回调传入），便于单测；
 * 路由表到 FeatureSource 的接线见 config/search.ts。
 */

/** 路由 meta 归一化后的功能源 */
export interface FeatureSource {
  /** 完整路径，如 /monitor/rule-groups */
  path: string
  /** 标题的 i18n key */
  titleKey?: string
  /** 参与匹配但不展示的别名（如一级模块的 meta.subTitleKey） */
  aliasKeys?: readonly string[]
  icon?: IconData
  /** 只对这些全局角色可见（与侧边菜单同一口径） */
  roles?: readonly GlobalRole[]
  /** 不进菜单的页内路由（如详情页） */
  menuExcluded?: boolean
  /** 既不进菜单、也不作为功能入口（如「关于」） */
  searchExcluded?: boolean
}

/** 搜索面板里的一条功能入口 */
export interface FeatureEntry {
  path: string
  titleKey: string
  aliasKeys: readonly string[]
  /** 所属一级模块的 i18n key，作为卡片的副标题 */
  categoryKey?: string
  icon?: IconData
}

/** 标题按关键词切分后的片段，命中段用 <mark> 渲染 */
export interface HighlightSegment {
  text: string
  match: boolean
}

/** 一条已翻译好的搜索结果 */
export interface FeatureMatch {
  entry: FeatureEntry
  title: string
  /** 所属模块文案，无则为空串 */
  category: string
  segments: HighlightSegment[]
}

type TitledSource = FeatureSource & { titleKey: string }

/** 可搜索的功能页：有标题、不进「页内」、角色可见、且不是动态路由 */
function isFeature(source: FeatureSource, roles: readonly GlobalRole[]): source is TitledSource {
  if (!source.titleKey || source.menuExcluded || source.searchExcluded) return false
  if (source.path.includes(':')) return false
  if (!canVisitNavigation(source.path)) return false
  if (source.roles?.length && !source.roles.some((role) => roles.includes(role))) return false
  return true
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean)
}

/**
 * 整理功能入口：
 * - 一级模块（单段路径）自身在前，它的子页紧随其后，二级项沿用模块的图标并把模块名作为分类
 * - 与一级模块同路径的「一级项自身」（侧边栏的二级首项）不重复出现，其文案转为别名参与匹配
 * - 按 meta.roles 过滤，与侧边菜单保持一致
 */
export function buildFeatureEntries(
  sources: readonly FeatureSource[],
  roles: readonly GlobalRole[] = [],
): FeatureEntry[] {
  // 第一趟：按声明顺序收集一级模块
  const modules: { head: string; source: TitledSource }[] = []
  sources.forEach((source) => {
    if (!isFeature(source, roles)) return
    const [head] = segmentsOf(source.path)
    if (!head || segmentsOf(source.path).length !== 1) return
    if (modules.some((module) => module.head === head)) return
    modules.push({ head, source })
  })

  // 第二趟：模块自身 + 它的子页
  return modules.flatMap(({ head, source }) => {
    const children = sources.reduce<FeatureEntry[]>((entries, child) => {
      const segments = segmentsOf(child.path)
      if (segments.length < 2 || segments[0] !== head || !isFeature(child, roles)) return entries
      entries.push({
        path: child.path,
        titleKey: child.titleKey,
        aliasKeys: child.aliasKeys ?? [],
        categoryKey: source.titleKey,
        icon: source.icon,
      })
      return entries
    }, [])

    return [
      {
        path: source.path,
        titleKey: source.titleKey,
        aliasKeys: source.aliasKeys ?? [],
        icon: source.icon,
      },
      ...children,
    ]
  })
}

/** 把文本按关键词切分成「命中/未命中」片段，关键词为空时整段返回 */
export function highlightSegments(text: string, keyword: string): HighlightSegment[] {
  const needle = keyword.trim()
  if (!text) return []
  if (!needle) return [{ text, match: false }]

  const haystack = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const segments: HighlightSegment[] = []
  let from = 0

  for (;;) {
    const index = haystack.indexOf(lowerNeedle, from)
    if (index < 0) break
    if (index > from) segments.push({ text: text.slice(from, index), match: false })
    segments.push({ text: text.slice(index, index + needle.length), match: true })
    from = index + needle.length
  }

  if (!segments.length) return [{ text, match: false }]
  if (from < text.length) segments.push({ text: text.slice(from), match: false })
  return segments
}

/**
 * 按关键词过滤功能入口：标题、分类与别名都参与匹配（大小写不敏感），
 * 关键词为空时返回全部（面板打开即列出所有功能），顺序沿用菜单顺序。
 */
export function filterFeatureEntries(
  entries: readonly FeatureEntry[],
  keyword: string,
  translate: (key: string) => string,
): FeatureMatch[] {
  const needle = keyword.trim().toLowerCase()

  return entries.reduce<FeatureMatch[]>((matches, entry) => {
    const title = translate(entry.titleKey)
    const category = entry.categoryKey ? translate(entry.categoryKey) : ''
    const aliases = entry.aliasKeys.map(translate)

    if (needle) {
      const haystack = [title, category, ...aliases].join('\u0000').toLowerCase()
      if (!haystack.includes(needle)) return matches
    }

    matches.push({ entry, title, category, segments: highlightSegments(title, needle) })
    return matches
  }, [])
}

// ---------- 搜索历史 ----------

/** 搜索历史最多保留的条数 */
export const SEARCH_HISTORY_LIMIT = 8

/** localStorage 键，与 store 持久化键同前缀 */
export const SEARCH_HISTORY_STORAGE_KEY = 'beacon-web:search-history'

/** 把 localStorage 读到的任意值归一成干净的历史列表：去空、去重（最新的在前）、限量 */
export function normalizeHistory(input: unknown, limit = SEARCH_HISTORY_LIMIT): string[] {
  if (!Array.isArray(input)) return []

  const seen = new Set<string>()
  const history: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') continue
    const keyword = item.trim()
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)
    history.push(keyword)
    if (history.length >= limit) break
  }
  return history
}

/** 记录一次搜索：空关键词不入历史，重复的提到最前 */
export function pushHistory(
  history: readonly string[],
  keyword: string,
  limit = SEARCH_HISTORY_LIMIT,
): string[] {
  return normalizeHistory([keyword, ...history], limit)
}
