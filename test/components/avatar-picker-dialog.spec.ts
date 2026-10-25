import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ uploadAttachment: vi.fn() }))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))
vi.mock('@/utils/avatar-face', () => ({
  FACE_SIZE: 256,
  randomFaceConfig: vi.fn(),
  faceKey: vi.fn((config: { faceShape: string }) => JSON.stringify(config)),
  facePreviewUrl: vi.fn(
    (config: { faceShape: string }) => `data:image/svg+xml,${config.faceShape}`,
  ),
  faceFile: vi.fn(
    async (config: { faceShape: string }) =>
      new File([config.faceShape], `avatar-${config.faceShape}.png`, {
        type: 'image/png',
      }),
  ),
}))

import { uploadAttachment } from '@/api'
import type { UploadedObject } from '@/api/types/attachment'
import AvatarPickerDialog from '@/components/avatar/AvatarPickerDialog.vue'
import { faceFile, randomFaceConfig } from '@/utils/avatar-face'
import { MessagePlugin } from 'tdesign-vue-next'
import { componentOptions } from '../fixtures/components'

const uploaded = (name: string): UploadedObject => ({
  filename: `${name}.png`,
  mimeType: 'image/png',
  size: 3072,
  storageProvider: 'LOCAL',
  directory: 'avatars',
  fileKey: `avatars/${name}.png`,
  url: `https://cdn.example.test/avatars/${name}.png`,
  uploadedById: 'u1',
})

let index = 0

function mountDialog(props: Record<string, unknown> = {}) {
  const options = componentOptions()
  return mount(AvatarPickerDialog, {
    props: { visible: true, modelValue: '', count: 3, ...props },
    global: {
      ...options,
      stubs: { ...options.stubs, TImageViewer: true },
    },
  })
}

beforeEach(() => {
  index = 0
  vi.mocked(randomFaceConfig).mockImplementation(() => ({ faceShape: `face-${++index}` }) as never)
  vi.mocked(uploadAttachment).mockReset()
  vi.mocked(uploadAttachment).mockImplementation(async () => uploaded(`picked-${index}`))
  vi.mocked(MessagePlugin.warning).mockReset()
  vi.mocked(MessagePlugin.error).mockReset()
})

describe('AvatarPickerDialog', () => {
  it('打开时生成一批人脸候选，并回显当前头像', () => {
    const wrapper = mountDialog({
      modelValue: 'https://cdn.example.test/old.png',
    })

    expect(wrapper.findAll('.avatar-picker__option')).toHaveLength(3)
    expect(wrapper.find('.avatar-picker__option img').attributes('src')).toBe(
      'data:image/svg+xml,face-1',
    )
    // 右侧上传组件里回显已有头像
    expect(wrapper.find('.image-uploader__thumb img').attributes('src')).toBe(
      'https://cdn.example.test/old.png',
    )
  })

  it('点选人脸只做本地选中，不产生上传', async () => {
    const wrapper = mountDialog({ directory: 'teams' })
    await wrapper.findAll('.avatar-picker__option')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.avatar-picker__option')[1]!.classes()).toContain('is-active')
    // 选中的随机头像被塞进了上传组件的预览里
    expect(wrapper.find('.image-uploader__thumb img').attributes('src')).toBe(
      'data:image/svg+xml,face-2',
    )
    expect(faceFile).not.toHaveBeenCalled()
    expect(uploadAttachment).not.toHaveBeenCalled()
  })

  it('点确定时才上传一次，并输出附件地址', async () => {
    const wrapper = mountDialog({ directory: 'teams' })

    // 来回点几个候选都只是本地切换，一个附件都不会产生
    await wrapper.findAll('.avatar-picker__option')[1]!.trigger('click')
    await wrapper.findAll('.avatar-picker__option')[2]!.trigger('click')
    await flushPromises()
    expect(uploadAttachment).not.toHaveBeenCalled()

    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()

    expect(faceFile).toHaveBeenCalledTimes(1)
    expect(vi.mocked(faceFile).mock.calls[0]?.[0]).toEqual({
      faceShape: 'face-3',
    })
    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadAttachment).mock.calls[0]?.[1]).toBe('teams')

    const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
    expect(emitted).toMatch(/^https:\/\/cdn\.example\.test\/avatars\//)
    expect(wrapper.emitted('saved')?.at(-1)).toEqual([emitted])
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })

  it('右侧手动上传的图片优先，确定时直接用它', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('.avatar-picker__option')[0]!.trigger('click')
    expect(wrapper.find('.image-uploader__thumb img').attributes('src')).toBe(
      'data:image/svg+xml,face-1',
    )

    const input = wrapper.find('.image-uploader__input')
    Object.defineProperty(input.element, 'files', {
      value: [{ name: 'mine.png', type: 'image/png', size: 2048 }],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    // 手动上传覆盖草稿：上传组件换成上传结果，随机选中被取消
    expect(wrapper.find('.image-uploader__thumb img').attributes('src')).toMatch(/avatars\/picked-/)
    expect(wrapper.find('.avatar-picker__option').classes()).not.toContain('is-active')
    expect(uploadAttachment).toHaveBeenCalledTimes(1)

    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()

    expect(faceFile).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatch(/avatars\/picked-/)
  })

  it('没有选择任何头像时不会提交', async () => {
    const wrapper = mountDialog()

    await wrapper.find('[data-confirm]').trigger('click')

    expect(MessagePlugin.warning).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('换一批会重新生成候选', async () => {
    const wrapper = mountDialog()
    const first = wrapper.find('.avatar-picker__option img').attributes('src')

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('换一批'))!
      .trigger('click')

    expect(wrapper.find('.avatar-picker__option img').attributes('src')).not.toBe(first)
  })
})
