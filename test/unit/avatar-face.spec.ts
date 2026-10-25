import { afterEach, describe, expect, it, vi } from 'vitest'

import { faceFile, faceKey, facePreviewUrl, faceSvg, randomFaceConfig } from '@/utils/avatar-face'

const REQUIRED_PARTS = ['faceShape', 'eyes', 'eyebrows', 'mouth', 'nose', 'ears', 'hair'] as const

/** 假的 Image：可切换「解码成功 / 失败」，避免 happy-dom 真的去解析 SVG */
function stubImage(outcome: 'load' | 'error') {
  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      setTimeout(() => (outcome === 'load' ? this.onload?.() : this.onerror?.()), 0)
    }
  }
  vi.stubGlobal('Image', FakeImage)
}

/** 假的 canvas：只记录绘制并直接回一个 PNG blob */
function stubCanvas() {
  const canvas = HTMLCanvasElement.prototype as unknown as Record<string, unknown>
  const originals = { getContext: canvas.getContext, toBlob: canvas.toBlob }
  canvas.getContext = () => ({
    imageSmoothingEnabled: true,
    clearRect: () => {},
    drawImage: () => {},
  })
  canvas.toBlob = (callback: (blob: Blob | null) => void) =>
    callback(new Blob(['png'], { type: 'image/png' }))
  return () => {
    canvas.getContext = originals.getContext
    canvas.toBlob = originals.toBlob
  }
}

let restoreCanvas: (() => void) | null = null

afterEach(() => {
  restoreCanvas?.()
  restoreCanvas = null
  vi.unstubAllGlobals()
})

describe('face avatars (bitface)', () => {
  it('随机 config 覆盖所有必填部位，且能序列化成短 key', () => {
    const config = randomFaceConfig()

    for (const part of REQUIRED_PARTS) {
      expect(typeof config[part]).toBe('string')
      expect(config[part]).toBeTruthy()
    }
    expect(faceKey(config).length).toBeLessThan(400)
  })

  it('同一 config 得到同一张图，且补上了显式宽高', () => {
    const config = randomFaceConfig()

    expect(faceSvg(config)).toBe(faceSvg(config))
    const svg = faceSvg(config, 128)
    expect(svg).toContain('width="128"')
    expect(svg).toContain('height="128"')
    expect(svg).toContain('viewBox="0 0 16 16"')
  })

  it('不同 config 画出不同的脸', () => {
    const shapes = new Set(Array.from({ length: 8 }, () => faceSvg(randomFaceConfig())))
    expect(shapes.size).toBeGreaterThan(5)
  })

  it('预览是可直接放进 img 的 SVG dataURL（已编码）', () => {
    const url = facePreviewUrl(randomFaceConfig())

    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(url).toContain('%3Csvg')
    expect(url).not.toContain('<svg')
  })
})

describe('faceFile', () => {
  it('把 SVG 画到 canvas 后输出 PNG 文件', async () => {
    stubImage('load')
    restoreCanvas = stubCanvas()

    const file = await faceFile(randomFaceConfig())

    expect(file).toBeInstanceOf(File)
    expect(file?.type).toBe('image/png')
    expect(file?.name).toMatch(/^avatar-[0-9a-z]+\.png$/)
  })

  it('SVG 解码失败时返回 null，不抛错', async () => {
    stubImage('error')

    await expect(faceFile(randomFaceConfig())).resolves.toBeNull()
  })

  it('没有 canvas 实现时返回 null', async () => {
    stubImage('load')

    await expect(faceFile(randomFaceConfig())).resolves.toBeNull()
  })
})
