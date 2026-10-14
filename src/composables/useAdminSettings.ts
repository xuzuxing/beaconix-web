import { computed, reactive, ref, shallowRef } from 'vue'

import { listAdminSettings, updateAdminSetting } from '@/api'
import type { AdminSetting } from '@/api/types/admin'
import {
  buildSettingTabs,
  isDraftDirty,
  parseDraft,
  toDraft,
  type SettingDraft,
  type SettingDraftError,
  type SettingTab,
} from '@/utils/settings-presenter'

/**
 * 平台配置（`/admin/settings`）。
 *
 * 一次拉全量后按 group 拆成 tab；每个 tab 一个保存按钮，
 * 只提交本 tab 内有改动的项，逐项 PATCH，遇到第一个失败就停下，
 * 已经写成功的项保留在本地，不再回退。
 */

/** 一次保存的结果：saved/total 用于提示，「值非法」与「接口失败」分开表达 */
export interface SaveGroupResult {
  /** 已成功写入的项数 */
  saved: number
  /** 本组内有改动、被提交的项数 */
  total: number
  /** 值本身非法（JSON 解析失败等）导致中断的那一项 */
  invalid?: { key: string; reason: SettingDraftError }
  /** 接口失败的原因，请求层已提示过 */
  error?: string
}

export function useAdminSettings() {
  // 配置项的值是递归类型，用 shallowRef 避免 ref 的深层 UnwrapRef 触发 TS2589；
  // 因此下面所有变更都整体替换数组，不就地 splice。
  const settings = shallowRef<AdminSetting[]>([])
  const loading = ref(false)
  const error = ref('')
  /** 正在保存的分组 key，用于按钮 loading */
  const savingGroup = ref('')
  const drafts = reactive(new Map<string, SettingDraft>())
  let request = 0

  const tabs = computed<SettingTab[]>(() => buildSettingTabs(settings.value))

  /** 某个配置项正在编辑的值：没有草稿时用它的当前值 */
  function draftOf(item: AdminSetting): SettingDraft {
    const draft = drafts.get(item.key)
    return draft === undefined ? toDraft(item) : draft
  }

  function setDraft(key: string, value: SettingDraft) {
    drafts.set(key, value)
  }

  /** 该项是否有未保存的改动 */
  function isDirty(item: AdminSetting) {
    return isDraftDirty(item, draftOf(item))
  }

  /** 该分组内有改动的项数 */
  function dirtyCount(group: string) {
    return settings.value.filter((item) => item.group === group && isDirty(item)).length
  }

  function rebuildDrafts() {
    drafts.clear()
    settings.value.forEach((item) => drafts.set(item.key, toDraft(item)))
  }

  /** 放弃某个分组里未保存的改动 */
  function resetGroup(group: string) {
    settings.value.forEach((item) => {
      if (item.group === group) drafts.set(item.key, toDraft(item))
    })
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listAdminSettings()
      if (token !== request) return
      settings.value = result ?? []
      rebuildDrafts()
    } catch (cause) {
      if (token !== request) return
      settings.value = []
      drafts.clear()
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 就地替换一项，避免整表重载导致 tab 与滚动位置丢失 */
  function replaceSetting(updated: AdminSetting) {
    const next = settings.value.slice()
    const index = next.findIndex((item) => item.key === updated.key)
    if (index < 0) next.push(updated)
    else next.splice(index, 1, updated)
    settings.value = next
    drafts.set(updated.key, toDraft(updated))
  }

  async function saveGroup(group: string): Promise<SaveGroupResult> {
    const targets = settings.value.filter((item) => item.group === group && isDirty(item))
    if (!targets.length) return { saved: 0, total: 0 }

    savingGroup.value = group
    let saved = 0
    try {
      for (const item of targets) {
        const parsed = parseDraft(item, draftOf(item))
        if (!parsed.ok) return { saved, total: targets.length, invalid: { key: item.key, reason: parsed.reason } }
        const updated = await updateAdminSetting(item.key, parsed.value)
        replaceSetting(updated)
        saved += 1
      }
      return { saved, total: targets.length }
    } catch (cause) {
      return {
        saved,
        total: targets.length,
        error: cause instanceof Error ? cause.message : '',
      }
    } finally {
      savingGroup.value = ''
    }
  }

  return {
    settings,
    tabs,
    loading,
    error,
    savingGroup,
    draftOf,
    setDraft,
    isDirty,
    dirtyCount,
    load,
    saveGroup,
    resetGroup,
  }
}
