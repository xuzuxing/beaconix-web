import type { AdminSetting, SettingValue } from '@/api/types/admin'

/**
 * 平台配置页的展现层纯函数，不涉及请求与文案，便于单测：
 * - 分组：每一项自带的 group 决定它属于哪个 tab，tab 的清单与顺序取自
 *   `develop.configGroup` 这一项的值（字符串数组），未声明但实际存在的分组追加在后面
 * - 草稿：JSON 项在表单里以文本编辑，其余保持原始标量类型，null 表示未填
 * - 脏值：与初始值比较；密文项不回显，只看「有没有填新值」
 */

/** 承载 tab 清单与顺序的配置项 key，mock 数据源与后端约定都用它 */
export const CONFIG_GROUP_KEY = 'develop.configGroup'

/** 编辑中的值：JSON 用文本，null 表示空（例如数字被清空） */
export type SettingDraft = string | number | boolean | null

/** 草稿无法转成提交值的原因，由页面翻译成提示文案 */
export type SettingDraftError =
  | 'notString'
  | 'notNumber'
  | 'notBoolean'
  | 'emptyJson'
  | 'invalidJson'

export type SettingDraftParse =
  | { ok: true; value: SettingValue }
  | { ok: false; reason: SettingDraftError }

/** 一个 tab 内的二级分组：`key` 为空串表示未声明 section 的项（直接挂在 tab 顶层） */
export interface SettingSection {
  key: string
  items: AdminSetting[]
}

/** 一个 tab：分组 key、该分组下的配置项（保持接口返回顺序），以及按 section 切出的二级分组 */
export interface SettingTab {
  key: string
  items: AdminSetting[]
  sections: SettingSection[]
}
/** 非法 JSON 的签名，保证它不会与任何合法值相等 */
const INVALID_JSON_SIGNATURE = '\u0000invalid-json'

/** 初始草稿：密文项一律从空值开始 */
export function toDraft(item: AdminSetting): SettingDraft {
  if (item.isSecret) return ''
  switch (item.valueType) {
    case 'STRING':
      return typeof item.value === 'string' ? item.value : ''
    case 'NUMBER':
      return typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : null
    case 'BOOLEAN':
      return item.value === true
    case 'JSON':
      return item.value === null || item.value === undefined
        ? ''
        : JSON.stringify(item.value, null, 2)
  }
}

function normalizeJson(draft: SettingDraft): string {
  if (typeof draft !== 'string' || draft.trim() === '') return ''
  try {
    return JSON.stringify(JSON.parse(draft))
  } catch {
    return INVALID_JSON_SIGNATURE
  }
}

/** 比较用的规范签名：JSON 忽略缩进差异，非法文本单独标记 */
export function draftSignature(item: AdminSetting, draft: SettingDraft): string {
  switch (item.valueType) {
    case 'STRING':
      return `s:${typeof draft === 'string' ? draft : ''}`
    case 'NUMBER':
      return `n:${typeof draft === 'number' && Number.isFinite(draft) ? draft : ''}`
    case 'BOOLEAN':
      return `b:${draft === true}`
    case 'JSON':
      return `j:${normalizeJson(draft)}`
  }
}

/** 与本项当前值相比是否有改动 */
export function isDraftDirty(item: AdminSetting, draft: SettingDraft): boolean {
  if (item.isSecret) return draft !== '' && draft !== null
  return draftSignature(item, draft) !== draftSignature(item, toDraft(item))
}

/** 草稿转提交值 */
export function parseDraft(item: AdminSetting, draft: SettingDraft): SettingDraftParse {
  switch (item.valueType) {
    case 'STRING':
      if (typeof draft !== 'string') return { ok: false, reason: 'notString' }
      return { ok: true, value: draft }
    case 'NUMBER': {
      if (typeof draft === 'number' && Number.isFinite(draft)) return { ok: true, value: draft }
      if (typeof draft === 'string' && draft.trim() !== '') {
        const parsed = Number(draft)
        if (Number.isFinite(parsed)) return { ok: true, value: parsed }
      }
      return { ok: false, reason: 'notNumber' }
    }
    case 'BOOLEAN':
      if (typeof draft === 'boolean') return { ok: true, value: draft }
      return { ok: false, reason: 'notBoolean' }
    case 'JSON': {
      if (typeof draft !== 'string' || draft.trim() === '') {
        return { ok: false, reason: 'emptyJson' }
      }
      try {
        return { ok: true, value: JSON.parse(draft) as SettingValue }
      } catch {
        return { ok: false, reason: 'invalidJson' }
      }
    }
  }
}

/** `develop.configGroup` 声明的分组：缺失或不是字符串数组时返回空数组 */
export function declaredSettingGroups(settings: AdminSetting[]): string[] {
  const item = settings.find((entry) => entry.key === CONFIG_GROUP_KEY)
  if (!item || !Array.isArray(item.value)) return []
  const keys: string[] = []
  item.value.forEach((entry) => {
    if (typeof entry !== 'string') return
    const key = entry.trim()
    if (key && !keys.includes(key)) keys.push(key)
  })
  return keys
}

/** tab 清单：先按声明顺序，接口里有但没声明的分组追加在后面，保证配置不丢 */
export function resolveSettingGroups(settings: AdminSetting[]): string[] {
  const groups = declaredSettingGroups(settings)
  settings.forEach((item) => {
    if (item.group && !groups.includes(item.group)) groups.push(item.group)
  })
  return groups
}

/** 按 section 切分：保持接口返回顺序，未声明 section 的项归到空串那一段 */
function buildSections(items: AdminSetting[]): SettingSection[] {
  const bySection = new Map<string, AdminSetting[]>()
  items.forEach((item) => {
    const key = item.section?.trim() ?? ''
    const list = bySection.get(key)
    if (list) list.push(item)
    else bySection.set(key, [item])
  })
  return Array.from(bySection, ([key, sectionItems]) => ({ key, items: sectionItems }))
}

/** 拆成 tab：空分组也保留，便于提示该分组还没建配置项 */
export function buildSettingTabs(settings: AdminSetting[]): SettingTab[] {
  const byGroup = new Map<string, AdminSetting[]>()
  settings.forEach((item) => {
    const list = byGroup.get(item.group)
    if (list) list.push(item)
    else byGroup.set(item.group, [item])
  })
  return resolveSettingGroups(settings).map((key) => {
    const items = byGroup.get(key) ?? []
    return { key, items, sections: buildSections(items) }
  })
}
