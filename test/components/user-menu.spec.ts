import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

import UserMenu from '@/components/UserMenu.vue'
import { useUserStore } from '@/stores'
import type { User } from '@/api/types'
import { componentOptions } from '../fixtures/components'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('tdesign-vue-next', () => ({ MessagePlugin: { success: vi.fn() } }))

/** 弹层 stub：trigger 与 content 都渲染出来，hover 时把 visible 同步给父组件 */
const popup = defineComponent({
  props: {
    visible: { type: Boolean, default: false },
    placement: { type: String, default: '' },
    trigger: { type: String, default: '' },
    showArrow: { type: Boolean, default: true },
    overlayClassName: { type: String, default: '' },
  },
  emits: ['update:visible'],
  setup:
    (props, { slots, emit }) =>
    () =>
      h('div', { class: 'popup-stub' }, [
        h(
          'div',
          {
            class: 'popup-stub__trigger',
            onMouseenter: () => emit('update:visible', true),
          },
          slots.default?.(),
        ),
        h('div', { class: props.overlayClassName }, slots.content?.()),
      ]),
})

const avatar = defineComponent({
  props: {
    size: { type: String, default: '' },
    image: { type: String, default: '' },
  },
  setup:
    (props, { slots }) =>
    () =>
      h('span', { class: 'avatar-stub', 'data-image': props.image }, slots.default?.()),
})

const user = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  avatarUrl: null,
  globalRole: 'USER',
  isActive: true,
  emailVerified: true,
  lastSeenAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as User

function mountMenu(attrs: Record<string, string> = {}) {
  const base = componentOptions()
  // 组件内的 store 与挂载用的 pinia 必须是同一个实例
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setUser(user)
  return mount(UserMenu, {
    attrs,
    global: {
      plugins: [...base.plugins, pinia],
      stubs: { ...base.stubs, TPopup: popup, TAvatar: avatar },
    },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('user menu', () => {
  it('把使用方传入的 class 绑到头像按钮上', () => {
    const wrapper = mountMenu({ class: 'app-header__user' })
    const trigger = wrapper.get('button.user-menu__trigger')
    expect(trigger.classes()).toContain('app-header__user')
  })

  it('展示账号信息、菜单分组与版本号', async () => {
    const wrapper = mountMenu()
    await flushPromises()

    expect(wrapper.get('.user-panel__name').text()).toBe('Ada Lovelace')
    expect(wrapper.get('.user-panel__email').text()).toBe('ada@example.test')

    const labels = wrapper.findAll('.user-panel__item').map((item) => item.text())
    expect(labels).toContain('个人信息')
    expect(labels).toContain('退出登录')
    expect(wrapper.get('.user-panel__version').text()).toContain('acl-test')
  })

  it('弹层用独立 overlayClassName，避免样式污染', () => {
    const wrapper = mountMenu()
    const stub = wrapper.getComponent(popup)
    expect(stub.props('overlayClassName')).toBe('user-menu-popup')
    expect(stub.props('placement')).toBe('bottom-right')
  })

  it('复制按钮写入剪贴板', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const wrapper = mountMenu()
    await wrapper.findAll('.user-panel__copy')[0]!.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('Ada Lovelace')
  })
})
