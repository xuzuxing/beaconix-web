import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '@/locales/zh-CN'
import en from '@/locales/en-US'

const slot = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const input = defineComponent({
  props: ['modelValue', 'value'],
  emits: ['update:modelValue', 'change'],
  setup:
    (props, { emit, attrs }) =>
    () =>
      h('input', {
        ...attrs,
        value: props.modelValue ?? props.value,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
})
const select = defineComponent({
  props: ['modelValue', 'value', 'options', 'disabled'],
  emits: ['update:modelValue', 'change'],
  setup:
    (props, { emit, attrs }) =>
    () =>
      h(
        'select',
        {
          ...attrs,
          disabled: props.disabled,
          value: props.modelValue ?? props.value,
          onChange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value
            emit('update:modelValue', value)
            emit('change', value)
          },
        },
        (props.options as { label: string; value: string }[]).map((option) =>
          h('option', { value: option.value }, option.label),
        ),
      ),
})
const checkbox = defineComponent({
  props: ['checked', 'modelValue', 'disabled'],
  emits: ['update:modelValue', 'change'],
  setup:
    (props, { emit, slots }) =>
    () =>
      h('label', [
        h('input', {
          type: 'checkbox',
          disabled: props.disabled,
          checked: props.checked ?? props.modelValue,
          onChange: (event: Event) => {
            const checked = (event.target as HTMLInputElement).checked
            emit('update:modelValue', checked)
            emit('change', checked)
          },
        }),
        slots.default?.(),
      ]),
})
const dialog = defineComponent({
  props: ['visible'],
  emits: ['confirm', 'update:visible'],
  setup:
    (props, { emit, slots }) =>
    () =>
      props.visible
        ? h('div', [
            slots.default?.(),
            h('button', { 'data-confirm': '', onClick: () => emit('confirm') }, 'Confirm'),
          ])
        : null,
})
const popconfirm = defineComponent({
  emits: ['confirm'],
  setup:
    (_, { emit, slots }) =>
    () =>
      h('div', [
        slots.default?.(),
        h('button', { 'data-popconfirm': '', onClick: () => emit('confirm') }, 'Confirm revoke'),
      ]),
})
const alert = defineComponent({
  props: ['message'],
  setup: (props) => () => h('p', { role: 'alert' }, props.message),
})
export function componentOptions() {
  return {
    plugins: [
      createI18n({
        legacy: false,
        locale: 'zh-CN',
        messages: { 'zh-CN': zh, 'en-US': en },
      }),
    ],
    stubs: {
      TDialog: dialog,
      TDrawer: dialog,
      TInput: input,
      TSelect: select,
      TCheckbox: checkbox,
      TPopconfirm: popconfirm,
      TButton: defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('button', slots.default?.()),
      }),
      TForm: slot,
      TFormItem: slot,
      TTag: slot,
      TAlert: alert,
      TLoading: slot,
    },
  }
}
