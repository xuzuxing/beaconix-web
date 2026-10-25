import { mount } from '@vue/test-utils'
import { KeepAlive, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { providePageHeader, usePageHeader, type PageHeaderState } from '@/composables/usePageHeader'

/**
 * 标题栏状态在 keep-alive 下的生命周期。
 *
 * 回归场景：二级页面（如工单分类）返回后再进入时，被缓存的页面会被重新激活，
 * 而静态 title / back 不会触发 watchEffect 重跑——曾经因此丢掉左上角的返回按钮。
 */

const StaticPage = defineComponent({
  name: 'StaticPage',
  setup() {
    usePageHeader({ title: '工单分类', back: '/admin/tickets' })
    return () => h('div', 'static')
  },
})

const PlainPage = defineComponent({
  name: 'PlainPage',
  setup: () => () => h('div', 'plain'),
})

const dynamicTitle = ref('旧标题')
const DynamicPage = defineComponent({
  name: 'DynamicPage',
  setup() {
    usePageHeader({ title: () => dynamicTitle.value, back: '/list' })
    return () => h('div', 'dynamic')
  },
})

type PageName = 'static' | 'plain' | 'dynamic'

function mountHost(initial: PageName) {
  let state: PageHeaderState | null = null
  const current = ref<PageName>(initial)

  const HeaderHost = defineComponent({
    name: 'HeaderHost',
    setup() {
      state = providePageHeader()
      return () =>
        h(KeepAlive, null, [
          current.value === 'static'
            ? h(StaticPage)
            : current.value === 'dynamic'
              ? h(DynamicPage)
              : h(PlainPage),
        ])
    },
  })

  const wrapper = mount(HeaderHost)
  return {
    wrapper,
    header: () => state as PageHeaderState,
    /** 切换 keep-alive 里的当前页面，并等 deactivated / activated 跑完 */
    async visit(page: PageName) {
      current.value = page
      await nextTick()
      await nextTick()
    },
  }
}

describe('usePageHeader', () => {
  it('mount 时写入标题与返回目标', () => {
    const host = mountHost('static')
    expect(host.header().title.value).toBe('工单分类')
    expect(host.header().back.value).toBe('/admin/tickets')
    host.wrapper.unmount()
  })

  it('切到别的页面时清空标题栏', async () => {
    const host = mountHost('static')
    await host.visit('plain')

    expect(host.header().title.value).toBe('')
    expect(host.header().back.value).toBeNull()
    host.wrapper.unmount()
  })

  it('再次激活被缓存的页面时恢复标题与返回目标', async () => {
    const host = mountHost('static')
    await host.visit('plain')
    await host.visit('static')

    expect(host.header().title.value).toBe('工单分类')
    expect(host.header().back.value).toBe('/admin/tickets')
    host.wrapper.unmount()
  })

  it('停用期间不动共享标题栏，重新激活时补写最新值', async () => {
    const host = mountHost('dynamic')
    expect(host.header().title.value).toBe('旧标题')

    await host.visit('plain')
    dynamicTitle.value = '新标题'
    await nextTick()

    // 后台缓存页的变化不应覆盖当前页的标题栏
    expect(host.header().title.value).toBe('')

    await host.visit('dynamic')
    expect(host.header().title.value).toBe('新标题')
    expect(host.header().back.value).toBe('/list')
    host.wrapper.unmount()
  })
})
