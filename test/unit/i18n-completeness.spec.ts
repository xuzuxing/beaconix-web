import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import zh from '@/locales/zh-CN'
import en from '@/locales/en-US'

/**
 * 多语言完整性回归：任何新增的 t('key') 都必须同时在中文与英文语言包中存在，
 * 否则界面会直接显示 key。动态拼接的 key（`rum.${tab}` 等）由各自的静态枚举
 * 覆盖，这里只校验可静态提取的调用。
 */

function flattenKeys(value: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    out.add(path)
    flattenKeys(child, path, out)
  }
  return out
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== 'locales') walk(path, files)
    } else if (/\.(vue|ts)$/.test(entry)) {
      files.push(path)
    }
  }
  return files
}

const STATIC_CALLS = [/\bt\(\s*'([^']+)'/g, /\bt\(\s*"([^"]+)"/g]

function usedKeys(): Set<string> {
  const used = new Set<string>()
  for (const file of walk('src')) {
    const text = readFileSync(file, 'utf8')
    for (const regex of STATIC_CALLS) {
      regex.lastIndex = 0
      for (const match of text.matchAll(regex)) {
        const key = match[1]
        // 跳过拼接与模板字符串里的片段，动态 key 由枚举覆盖。
        if (key.includes('+') || key.includes('${') || key.endsWith('.')) continue
        used.add(key)
      }
    }
  }
  return used
}

describe('i18n completeness', () => {
  const zhKeys = flattenKeys(zh)
  const enKeys = flattenKeys(en)

  it('keeps zh-CN and en-US key sets identical', () => {
    expect([...zhKeys].filter((key) => !enKeys.has(key))).toEqual([])
    expect([...enKeys].filter((key) => !zhKeys.has(key))).toEqual([])
  })

  it('resolves every statically referenced key in both locales', () => {
    const used = usedKeys()
    expect([...used].filter((key) => !zhKeys.has(key))).toEqual([])
    expect([...used].filter((key) => !enKeys.has(key))).toEqual([])
  })
})
