// 搜索面板的渲染冒烟：用 vite 的 SSR 模块加载器编译真实的 GlobalSearchPanel.vue，
// 断言两种状态（搜索历史 / 功能入口）的结构、空态与高亮，不需要后端与浏览器。
// 运行：node test/search-panel-render.mjs
import assert from 'node:assert/strict'

import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const panel = (await server.ssrLoadModule('/src/components/search/GlobalSearchPanel.vue')).default
  const zhCN = (await server.ssrLoadModule('/src/locales/zh-CN.ts')).default
  const i18n = createI18n({
    legacy: false,
    locale: 'zh-CN',
    messages: { 'zh-CN': zhCN },
  })

  const render = async (props) => {
    const app = createSSRApp(panel, { history: [], activeIndex: -1, ...props })
    app.use(i18n)
    return renderToString(app)
  }

  const classesOf = (html, name) => html.match(new RegExp(`class="[^"]*${name}"`, 'g')) ?? []

  const icon = [['path', { d: 'M0 0h1v1H0z' }]]
  const monitor = {
    path: '/monitor',
    titleKey: 'menu.monitor',
    aliasKeys: [],
    icon,
  }
  const group = {
    path: '/monitor/rule-groups',
    titleKey: 'submenu.monitor.alertRules',
    aliasKeys: [],
  }

  // ---------- 输入关键词：功能入口 ----------
  const filled = await render({
    keyword: '监控',
    matches: [
      {
        entry: monitor,
        title: '云监控',
        category: '',
        segments: [{ text: '云监控', match: false }],
      },
      {
        entry: group,
        title: '检测异常条件',
        category: '云监控',
        segments: [
          { text: '检测', match: true },
          { text: '异常条件', match: false },
        ],
      },
    ],
    activeIndex: 1,
  })

  assert.ok(filled.includes('search-panel__main'), '面板主区存在')
  assert.ok(filled.includes('功能入口 (2)'), '分组标题带结果条数')
  assert.equal(classesOf(filled, 'search-card').length, 2, '两条结果渲染成两张卡片')
  assert.ok(classesOf(filled, 'search-card')[1].includes('is-active'), '键盘停留的卡片带 is-active')
  assert.deepEqual(
    [...filled.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)].map((match) => match[1]),
    ['检测'],
    '只有命中片段被 <mark> 包起来',
  )
  assert.ok(filled.includes('search-card__desc'), '分类作为卡片副标题渲染')
  assert.ok(filled.includes('<svg'), '有图标的条目渲染图标')
  assert.ok(filled.includes('search-panel-bg'), '面板带参考实现的顶部背景图')
  assert.ok(!filled.includes('搜索历史'), '有关键词时不展示搜索历史')

  // ---------- 关键词无结果 ----------
  const noMatch = await render({ keyword: '不存在的功能', matches: [] })
  assert.ok(noMatch.includes('未找到匹配的功能'), '无结果时显示空态')
  assert.ok(!noMatch.includes('功能入口'), '空态不渲染分组标题')

  // ---------- 未输入关键词：搜索历史（空态） ----------
  const historyEmpty = await render({ keyword: '', matches: [] })
  assert.ok(historyEmpty.includes('搜索历史'), '默认态展示搜索历史分组')
  assert.ok(historyEmpty.includes('暂无搜索历史'), '没有历史时显示空态')
  assert.ok(!historyEmpty.includes('全部清除'), '没有历史时不出现全部清除')
  assert.ok(!historyEmpty.includes('功能入口'), '默认态不列出全部功能')

  // ---------- 未输入关键词：搜索历史（有记录） ----------
  const historyList = await render({
    keyword: '',
    matches: [{ entry: monitor, title: '云监控', category: '', segments: [] }],
    history: ['云监控', '检测异常条件'],
    activeIndex: 1,
  })
  const historyItems = classesOf(historyList, 'search-history__item')
  assert.equal(historyItems.length, 2, '两条历史渲染成两条记录')
  assert.ok(historyItems[1].includes('is-active'), '键盘停留的历史记录带 is-active')
  assert.ok(!historyList.includes('暂无搜索历史'), '有历史时不显示空态')
  assert.ok(historyList.includes('全部清除'), '有历史时标题右侧提供全部清除')
  assert.ok(historyList.includes('search-panel__head-action'), '全部清除是标题行的文字操作')
  assert.ok(historyList.includes('检测异常条件'), '历史关键词渲染出来')
  assert.ok(!historyList.includes('search-card'), '默认态不渲染功能卡片')

  console.log('search panel render ok')
} finally {
  await server.close()
}
