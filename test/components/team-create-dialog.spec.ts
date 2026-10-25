import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

vi.mock('@/api', () => ({ createOrganization: vi.fn() }))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { success: vi.fn(), error: vi.fn() },
}))

import { createOrganization } from '@/api'
import TeamCreateDialog from '@/components/team/TeamCreateDialog.vue'
import { componentOptions } from '../fixtures/components'

const textarea = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit, attrs }) =>
    () =>
      h('textarea', {
        ...attrs,
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      }),
})

/** Logo 字段的替身：点一下就当作在弹窗里选好了图（真实框 + 弹窗由它自己的测试覆盖） */
const avatarField = defineComponent({
  props: ['modelValue', 'directory', 'disabled'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h(
        'button',
        {
          'data-avatar-field': '',
          'data-directory': props.directory,
          onClick: () => emit('update:modelValue', 'https://cdn.example.test/teams/picked.png'),
        },
        props.modelValue ?? '',
      ),
})

function mountDialog() {
  const options = componentOptions()
  return mount(TeamCreateDialog, {
    props: { visible: true },
    global: {
      ...options,
      stubs: {
        ...options.stubs,
        TTextarea: textarea,
        AvatarPickerField: avatarField,
      },
    },
  })
}

beforeEach(() => {
  vi.mocked(createOrganization).mockReset()
})

describe('TeamCreateDialog', () => {
  it('左右布局：左侧表单，右侧 Logo 单入口与官网', () => {
    const wrapper = mountDialog()

    const [left, right] = wrapper.findAll('.team-create__column')
    expect(left!.classes()).not.toContain('team-create__column--aside')
    expect(right!.classes()).toContain('team-create__column--aside')

    // 左侧只有文本类输入，Logo 预览框落在右侧列
    expect(left!.find('textarea').exists()).toBe(true)
    expect(left!.find('[data-avatar-field]').exists()).toBe(false)
    expect(right!.find('[data-avatar-field]').attributes('data-directory')).toBe('teams')
    expect(right!.find('input[maxlength="200"]').exists()).toBe(true)
    // 内嵌上传组件已移除，Logo 只有一个入口
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('在 Logo 弹窗里选好后创建团队，payload 带上该地址', async () => {
    const org = { id: 'org-new', name: 'Acme Corp', slug: 'acme-corp' } as never
    vi.mocked(createOrganization).mockResolvedValue(org)

    const wrapper = mountDialog()
    await wrapper.find('[data-avatar-field]').trigger('click')
    expect(wrapper.find('[data-avatar-field]').text()).toBe(
      'https://cdn.example.test/teams/picked.png',
    )

    await wrapper.find('input[maxlength="100"]').setValue('Acme Corp')
    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()

    expect(createOrganization).toHaveBeenCalledWith({
      name: 'Acme Corp',
      slug: 'acme-corp',
      logoUrl: 'https://cdn.example.test/teams/picked.png',
    })
    expect(wrapper.emitted('created')?.[0]).toEqual([org])

    wrapper.unmount()
  })

  it('未选 Logo 时 payload 不含 logoUrl', async () => {
    vi.mocked(createOrganization).mockResolvedValue({ id: 'org-new' } as never)

    const wrapper = mountDialog()
    await wrapper.find('input[maxlength="100"]').setValue('Acme Corp')
    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()

    expect(createOrganization).toHaveBeenCalledWith({
      name: 'Acme Corp',
      slug: 'acme-corp',
    })

    wrapper.unmount()
  })
})
