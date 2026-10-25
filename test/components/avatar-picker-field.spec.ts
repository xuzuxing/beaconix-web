import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import AvatarPickerField from '@/components/avatar/AvatarPickerField.vue'
import { componentOptions } from '../fixtures/components'

/** 弹窗替身：打开后提供一个「选中」按钮 */
const pickerDialog = defineComponent({
  props: ['visible', 'modelValue', 'variant', 'directory'],
  emits: ['update:visible', 'update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      props.visible
        ? h(
            'button',
            {
              'data-picker-pick': '',
              onClick: () => emit('update:modelValue', 'https://cdn.example.test/picked.png'),
            },
            'pick',
          )
        : null,
})

function mountField(props: Record<string, unknown> = {}) {
  const options = componentOptions()
  return mount(AvatarPickerField, {
    props: { modelValue: '', ...props },
    global: {
      ...options,
      stubs: { ...options.stubs, AvatarPickerDialog: pickerDialog },
    },
  })
}

describe('AvatarPickerField', () => {
  it('没有值时显示空态，点击打开弹窗', async () => {
    const wrapper = mountField()

    expect(wrapper.find('.avatar-field__box').classes()).toContain('is-empty')
    expect(wrapper.find('.avatar-field__image').exists()).toBe(false)
    expect(wrapper.find('[data-picker-pick]').exists()).toBe(false)

    await wrapper.find('.avatar-field__box').trigger('click')
    expect(wrapper.find('[data-picker-pick]').exists()).toBe(true)
  })

  it('有值时直接预览，并把弹窗选中的地址写回 v-model', async () => {
    const wrapper = mountField({
      modelValue: 'https://cdn.example.test/old.png',
    })

    expect(wrapper.find('.avatar-field__box').classes()).not.toContain('is-empty')
    expect(wrapper.find('.avatar-field__image').attributes('src')).toBe(
      'https://cdn.example.test/old.png',
    )

    await wrapper.find('.avatar-field__box').trigger('click')
    await wrapper.find('[data-picker-pick]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      'https://cdn.example.test/picked.png',
    ])
  })

  it('禁用时点击不打开弹窗', async () => {
    const wrapper = mountField({ disabled: true })

    await wrapper.find('.avatar-field__box').trigger('click')

    expect(wrapper.find('[data-picker-pick]').exists()).toBe(false)
  })
})
