import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  SEARCH_HISTORY_LIMIT,
  buildFeatureEntries,
  filterFeatureEntries,
  highlightSegments,
  normalizeHistory,
  pushHistory,
} from '../src/utils/feature-search.ts'

/** 模拟 i18n：没有的键回显键名，便于断言 */
const labels = {
  'menu.dashboard': '概览',
  'menu.monitor': '云监控',
  'submenu.monitor.manage': '监控管理',
  'submenu.monitor.overview': '监控概览',
  'submenu.monitor.alertRules': '检测异常条件',
  'menu.admin': '管理后台',
  'submenu.admin.tenants': '租户管理',
  'monitorPage.detail': '监控详情',
  'nav.about': '关于',
}
const translate = (key) => labels[key] ?? key

const iconA = [['path', { d: 'A' }]]
const iconB = [['path', { d: 'B' }]]

/** 模拟 config/search.ts 拍平后的路由表（声明顺序与 routes.ts 一致） */
const sources = [
  { path: '/dashboard', titleKey: 'menu.dashboard', icon: iconA },
  { path: '/monitor/overview', titleKey: 'submenu.monitor.overview' },
  {
    path: '/monitor',
    titleKey: 'menu.monitor',
    aliasKeys: ['submenu.monitor.manage'],
    icon: iconB,
  },
  { path: '/monitor/rule-groups', titleKey: 'submenu.monitor.alertRules' },
  {
    path: '/monitor/:projectId/:monitorId',
    titleKey: 'monitorPage.detail',
    menuExcluded: true,
  },
  { path: '/admin', titleKey: 'menu.admin', roles: ['SUPER_ADMIN'] },
  {
    path: '/admin/tenants',
    titleKey: 'submenu.admin.tenants',
    roles: ['SUPER_ADMIN'],
  },
  { path: '/about', titleKey: 'nav.about', searchExcluded: true },
  { path: '/unknown/page', titleKey: 'unknown.page' },
]

test('一级模块自身排在其子页之前，子页沿用模块的图标并标注分类', () => {
  const entries = buildFeatureEntries(sources, ['USER'])

  assert.deepEqual(
    entries.map((entry) => entry.path),
    ['/dashboard', '/monitor', '/monitor/overview', '/monitor/rule-groups'],
  )

  const [monitor, overview] = entries.slice(1)
  assert.equal(monitor.icon, iconB)
  assert.equal(monitor.categoryKey, undefined)

  assert.equal(overview.icon, iconB)
  assert.equal(overview.categoryKey, 'menu.monitor')
})

test('详情页、「关于」与没有一级模块的子页都不进结果，角色可见性与菜单一致', () => {
  const paths = buildFeatureEntries(sources, ['USER']).map((entry) => entry.path)

  assert.ok(!paths.includes('/monitor/:projectId/:monitorId'))
  assert.ok(!paths.includes('/about'))
  assert.ok(!paths.includes('/unknown/page'))
  assert.ok(!paths.includes('/admin'))
})

test('平台管理后台只对 SUPER_ADMIN 出现，且模块自身在前', () => {
  const paths = buildFeatureEntries(sources, ['SUPER_ADMIN']).map((entry) => entry.path)

  assert.ok(paths.includes('/admin'))
  assert.ok(paths.indexOf('/admin') < paths.indexOf('/admin/tenants'))
})

test('空关键词返回全部功能，顺序沿用菜单顺序', () => {
  const entries = buildFeatureEntries(sources, ['USER'])
  const matches = filterFeatureEntries(entries, '   ', translate)

  assert.equal(matches.length, entries.length)
  assert.deepEqual(
    matches[0].segments,
    [{ text: '概览', match: false }],
    '没有关键词时不产生高亮段',
  )
})

test('关键词匹配标题与分类，大小写不敏感', () => {
  const entries = buildFeatureEntries(sources, ['USER'])

  const byTitle = filterFeatureEntries(entries, '检测', translate)
  assert.deepEqual(
    byTitle.map((match) => match.title),
    ['检测异常条件'],
  )
  assert.deepEqual(byTitle[0].segments, [
    { text: '检测', match: true },
    { text: '异常条件', match: false },
  ])

  // 子页的分类是所属模块，搜模块名能搜到它
  const byCategory = filterFeatureEntries(entries, '云监控', translate)
  assert.deepEqual(
    byCategory.map((match) => match.entry.path),
    ['/monitor', '/monitor/overview', '/monitor/rule-groups'],
  )
})

test('一级模块的 subTitleKey 作为别名参与匹配但不展示', () => {
  const entries = buildFeatureEntries(sources, ['USER'])
  const matches = filterFeatureEntries(entries, '监控管理', translate)

  assert.deepEqual(
    matches.map((match) => match.entry.path),
    ['/monitor'],
  )
  assert.equal(matches[0].title, '云监控')
})

test('大小写不敏感匹配，未命中时返回空数组', () => {
  const entries = [
    {
      path: '/monitor',
      titleKey: 'menu.monitor',
      aliasKeys: [],
      categoryKey: undefined,
    },
    {
      path: '/billing',
      titleKey: 'menu.billing',
      aliasKeys: [],
      categoryKey: undefined,
    },
  ]
  const localTranslate = (key) =>
    ({ 'menu.monitor': 'Monitor', 'menu.billing': '计费' })[key] ?? key

  assert.deepEqual(
    filterFeatureEntries(entries, 'MONITOR', localTranslate).map((match) => match.title),
    ['Monitor'],
  )
  assert.deepEqual(filterFeatureEntries(entries, 'monitorx', localTranslate), [])
})

test('高亮分段覆盖多次命中与首尾位置', () => {
  assert.deepEqual(highlightSegments('监控监控页', '监控'), [
    { text: '监控', match: true },
    { text: '监控', match: true },
    { text: '页', match: false },
  ])
  assert.deepEqual(highlightSegments('概览', '  '), [{ text: '概览', match: false }])
  assert.deepEqual(highlightSegments('', '概览'), [])
  assert.deepEqual(highlightSegments('未命中', '概览'), [{ text: '未命中', match: false }])
})

test('搜索历史归一化：去空、去重且最新的在前、超限截断', () => {
  assert.deepEqual(normalizeHistory([' 云监控 ', '云监控', '', '   ', '告警', 42]), [
    '云监控',
    '告警',
  ])
  assert.deepEqual(normalizeHistory('not-an-array'), [])
  assert.deepEqual(normalizeHistory(null), [])

  const many = Array.from({ length: SEARCH_HISTORY_LIMIT + 4 }, (_, index) => `k${index}`)
  assert.equal(normalizeHistory(many).length, SEARCH_HISTORY_LIMIT)
})

test('记录搜索：重复关键词提到最前，空关键词不写入，满额时丢掉最旧的', () => {
  assert.deepEqual(pushHistory(['a', 'b'], 'b'), ['b', 'a'])
  assert.deepEqual(pushHistory(['a'], '   '), ['a'])
  assert.deepEqual(pushHistory([], '监控'), ['监控'])

  const full = Array.from({ length: SEARCH_HISTORY_LIMIT }, (_, index) => `k${index}`)
  const pushed = pushHistory(full, '新的')
  assert.equal(pushed.length, SEARCH_HISTORY_LIMIT)
  assert.equal(pushed[0], '新的')
  assert.ok(!pushed.includes(full[full.length - 1]), '最旧的一条被挤出去')
})
