import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProjectCreateDialog from '@/components/project/ProjectCreateDialog.vue'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { createProject } from '@/api'
import { componentOptions } from '../fixtures/components'
import { project } from '../fixtures/access'

vi.mock('@/api', () => ({ createProject: vi.fn() }))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { success: vi.fn(), error: vi.fn() },
}))

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

function mountDialog() {
  const options = componentOptions()
  return mount(ProjectCreateDialog, {
    props: { visible: true },
    global: { ...options, stubs: { ...options.stubs, TTextarea: textarea } },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(createProject).mockReset()
  const org = useOrganizationStore()
  org.currentOrganizationId = 'o1'
  vi.spyOn(usePermissionsStore(), 'ensureProject').mockResolvedValue(null)
})

describe('creating a project from the header selector', () => {
  it('derives the key from the name and submits the payload', async () => {
    vi.mocked(createProject).mockResolvedValue(project('c'))
    const wrapper = mountDialog()
    const [nameInput, keyInput] = wrapper.findAll('input')

    await nameInput!.setValue('Beacon Web')
    expect((keyInput!.element as HTMLInputElement).value).toBe('BEACONWEB')

    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()

    expect(createProject).toHaveBeenCalledWith('o1', {
      name: 'Beacon Web',
      key: 'BEACONWEB',
    })
    expect(wrapper.emitted('created')?.[0]).toEqual([project('c')])
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('rejects a key outside the 2-10 uppercase alphanumeric contract', async () => {
    const wrapper = mountDialog()
    const [nameInput, keyInput] = wrapper.findAll('input')

    await nameInput!.setValue('Project A')
    await keyInput!.setValue('a')
    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()

    expect(createProject).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('项目标识需为 2-10 位大写字母或数字')
    wrapper.unmount()
  })

  it('keeps the dialog open and shows the server message on failure', async () => {
    vi.mocked(createProject).mockRejectedValue(new Error('Project key already taken'))
    const wrapper = mountDialog()
    const [nameInput] = wrapper.findAll('input')

    await nameInput!.setValue('Project A')
    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(wrapper.text()).toContain('Project key already taken')
    wrapper.unmount()
  })
})
