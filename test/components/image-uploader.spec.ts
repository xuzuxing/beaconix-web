import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ uploadAttachment: vi.fn() }))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { success: vi.fn(), error: vi.fn() },
}))

import { uploadAttachment } from '@/api'
import ImageUploader from '@/components/upload/ImageUploader.vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { componentOptions } from '../fixtures/components'

const uploaded = (overrides = {}) => ({
  filename: 'shot.png',
  mimeType: 'image/png',
  size: 2048,
  storageProvider: 'LOCAL',
  directory: 'tickets',
  fileKey: 'tickets/2026/10/shot.png',
  url: 'https://cdn.example.test/tickets/shot.png',
  uploadedById: 'user-1',
  ...overrides,
})

const fileOf = (name: string, type: string, size = 2048) =>
  ({ name, type, size }) as unknown as File

function mountUploader(props: Record<string, unknown> = {}) {
  const options = componentOptions()
  return mount(ImageUploader, {
    props,
    global: {
      ...options,
      stubs: { ...options.stubs, TImageViewer: true },
    },
  })
}

async function choose(wrapper: ReturnType<typeof mountUploader>, files: File[]) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: files,
    configurable: true,
  })
  await input.trigger('change')
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(uploadAttachment).mockReset()
  vi.mocked(MessagePlugin.error).mockReset()
})

describe('ImageUploader', () => {
  it('上传成功时把 UploadedObject 追加进 v-model', async () => {
    vi.mocked(uploadAttachment).mockResolvedValue(uploaded())
    const wrapper = mountUploader({ directory: 'tickets' })

    await choose(wrapper, [fileOf('shot.png', 'image/png')])

    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadAttachment).mock.calls[0]?.[1]).toBe('tickets')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.at(-1)?.[0]).toEqual([uploaded()])
  })

  it('超过 5MB 的图片不会发起上传', async () => {
    const wrapper = mountUploader()

    await choose(wrapper, [fileOf('huge.png', 'image/png', 6 * 1024 * 1024)])

    expect(uploadAttachment).not.toHaveBeenCalled()
    expect(MessagePlugin.error).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('非图片类型会被拒绝', async () => {
    const wrapper = mountUploader()

    await choose(wrapper, [fileOf('app.log', '')])

    expect(uploadAttachment).not.toHaveBeenCalled()
    expect(MessagePlugin.error).toHaveBeenCalledTimes(1)
  })

  it('已达数量上限时不再上传', async () => {
    const wrapper = mountUploader({
      maxCount: 2,
      modelValue: [uploaded(), uploaded({ fileKey: 'b.png', url: 'https://cdn/b.png' })],
    })

    await choose(wrapper, [fileOf('third.png', 'image/png')])

    expect(uploadAttachment).not.toHaveBeenCalled()
    expect(MessagePlugin.error).toHaveBeenCalledTimes(1)
  })

  it('多个文件只上传额度内的部分', async () => {
    vi.mocked(uploadAttachment).mockResolvedValue(uploaded())
    const wrapper = mountUploader({ maxCount: 1 })

    await choose(wrapper, [fileOf('a.png', 'image/png'), fileOf('b.png', 'image/png')])

    expect(uploadAttachment).toHaveBeenCalledTimes(1)
  })

  it('删除时从 v-model 中移除对应项', async () => {
    const first = uploaded()
    const second = uploaded({ fileKey: 'b.png', url: 'https://cdn/b.png' })
    const wrapper = mountUploader({ modelValue: [first, second] })

    const removes = wrapper.findAll('.image-uploader__remove')
    expect(removes).toHaveLength(2)
    await removes[0]?.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.at(-1)?.[0]).toEqual([second])
  })

  it('maxWidth 控制缩略图网格宽度（数字按 px，字符串原样）', () => {
    const gridStyle = (wrapper: ReturnType<typeof mountUploader>) =>
      wrapper.find('.image-uploader__grid').attributes('style') ?? ''

    expect(gridStyle(mountUploader())).toContain('max-width: 480px')
    expect(gridStyle(mountUploader({ maxWidth: 320 }))).toContain('max-width: 320px')
    expect(gridStyle(mountUploader({ maxWidth: '100%' }))).toContain('max-width: 100%')
  })

  it('单图模式已有图时仍可上传替换，只保留最新一张', async () => {
    const replacement = uploaded({
      fileKey: 'new.png',
      url: 'https://cdn.example.test/new.png',
    })
    vi.mocked(uploadAttachment).mockResolvedValue(replacement)
    const wrapper = mountUploader({ single: true, modelValue: [uploaded()] })

    const add = wrapper.find('.image-uploader__add')
    expect(add.exists()).toBe(true)
    expect(add.text()).toContain('更换图片')

    await choose(wrapper, [fileOf('new.png', 'image/png')])

    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([replacement])
  })
})
