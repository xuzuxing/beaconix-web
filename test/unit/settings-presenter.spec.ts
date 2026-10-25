import { describe, expect, it } from 'vitest'

import type { AdminSetting } from '@/api/types/admin'
import {
  CONFIG_GROUP_KEY,
  declaredSettingGroups,
  buildSettingTabs,
  isDraftDirty,
  parseDraft,
  resolveSettingGroups,
  toDraft,
} from '@/utils/settings-presenter'

function setting(
  partial: Partial<AdminSetting> & Pick<AdminSetting, 'key' | 'group'>,
): AdminSetting {
  return {
    name: partial.key,
    value: '',
    valueType: 'STRING',
    description: null,
    isSecret: false,
    isDefault: true,
    updatedById: null,
    createdAt: null,
    updatedAt: null,
    ...partial,
  }
}

describe('setting tabs', () => {
  it('orders tabs by develop.configGroup and appends undeclared groups', () => {
    const settings = [
      setting({ key: 'monitor.a', group: 'monitor' }),
      setting({
        key: CONFIG_GROUP_KEY,
        group: 'develop',
        valueType: 'JSON',
        value: ['shared', 'monitor'],
      }),
      setting({ key: 'shared.a', group: 'shared' }),
      setting({ key: 'custom.a', group: 'custom' }),
    ]

    expect(resolveSettingGroups(settings)).toEqual(['shared', 'monitor', 'develop', 'custom'])
    expect(buildSettingTabs(settings).map((tab) => tab.key)).toEqual([
      'shared',
      'monitor',
      'develop',
      'custom',
    ])
    // 配置项本身跟着它的 group 落到对应 tab
    expect(buildSettingTabs(settings)[1]?.items.map((item) => item.key)).toEqual(['monitor.a'])
  })

  it('falls back to the groups actually present when the declaration is unusable', () => {
    const settings = [
      setting({ key: 'b.one', group: 'b' }),
      setting({ key: 'a.one', group: 'a' }),
      setting({
        key: CONFIG_GROUP_KEY,
        group: 'develop',
        value: 'not-an-array',
      }),
    ]

    expect(declaredSettingGroups(settings)).toEqual([])
    expect(resolveSettingGroups(settings)).toEqual(['b', 'a', 'develop'])
  })

  it('keeps only unique non-empty strings from the declaration', () => {
    const settings = [
      setting({
        key: CONFIG_GROUP_KEY,
        group: 'develop',
        valueType: 'JSON',
        value: [' monitor ', '', 42, 'monitor', 'shared'],
      }),
    ]

    expect(declaredSettingGroups(settings)).toEqual(['monitor', 'shared'])
  })

  it('keeps a declared group with no items so the tab can show an empty state', () => {
    const settings = [
      setting({
        key: CONFIG_GROUP_KEY,
        group: 'develop',
        valueType: 'JSON',
        value: ['sprint'],
      }),
    ]

    // 声明顺序在前（sprint 无配置项 → 空 tab），未声明的 develop 追加在后
    expect(buildSettingTabs(settings).map((tab) => tab.key)).toEqual(['sprint', 'develop'])
    expect(buildSettingTabs(settings)[0]?.items).toEqual([])
  })
})

describe('setting drafts', () => {
  it('formats JSON drafts and ignores indentation when comparing', () => {
    const item = setting({
      key: 'project.policy',
      group: 'project',
      valueType: 'JSON',
      value: { enabled: true },
    })

    expect(toDraft(item)).toBe('{\n  "enabled": true\n}')
    expect(isDraftDirty(item, '{"enabled":true}')).toBe(false)
    expect(isDraftDirty(item, '{"enabled":false}')).toBe(true)
    expect(isDraftDirty(item, '{oops')).toBe(true)
  })

  it('treats a secret item as dirty only once a new value is typed', () => {
    const item = setting({
      key: 'system.smtpPassword',
      group: 'system',
      isSecret: true,
    })

    expect(toDraft(item)).toBe('')
    expect(isDraftDirty(item, '')).toBe(false)
    expect(isDraftDirty(item, null)).toBe(false)
    expect(isDraftDirty(item, 'new-secret')).toBe(true)
  })

  it('compares numbers and booleans by value', () => {
    const number = setting({
      key: 'monitor.timeout',
      group: 'monitor',
      valueType: 'NUMBER',
      value: 300,
    })
    expect(toDraft(number)).toBe(300)
    expect(isDraftDirty(number, 300)).toBe(false)
    expect(isDraftDirty(number, null)).toBe(true)

    const boolean = setting({
      key: 'system.maintenance',
      group: 'system',
      valueType: 'BOOLEAN',
      value: true,
    })
    expect(toDraft(boolean)).toBe(true)
    expect(isDraftDirty(boolean, true)).toBe(false)
    expect(isDraftDirty(boolean, false)).toBe(true)
  })
})

describe('parseDraft', () => {
  it('parses each value type and reports why it failed', () => {
    const text = setting({ key: 'system.siteName', group: 'system' })
    expect(parseDraft(text, 'Beacon')).toEqual({ ok: true, value: 'Beacon' })
    expect(parseDraft(text, 3)).toEqual({ ok: false, reason: 'notString' })

    const number = setting({
      key: 'monitor.retries',
      group: 'monitor',
      valueType: 'NUMBER',
      value: 1,
    })
    expect(parseDraft(number, 12)).toEqual({ ok: true, value: 12 })
    expect(parseDraft(number, '12')).toEqual({ ok: true, value: 12 })
    expect(parseDraft(number, null)).toEqual({ ok: false, reason: 'notNumber' })
    expect(parseDraft(number, 'abc')).toEqual({
      ok: false,
      reason: 'notNumber',
    })

    const boolean = setting({
      key: 'sprint.allowScopeChange',
      group: 'sprint',
      valueType: 'BOOLEAN',
      value: false,
    })
    expect(parseDraft(boolean, true)).toEqual({ ok: true, value: true })
    expect(parseDraft(boolean, 'true')).toEqual({
      ok: false,
      reason: 'notBoolean',
    })

    const json = setting({
      key: CONFIG_GROUP_KEY,
      group: 'develop',
      valueType: 'JSON',
      value: [],
    })
    expect(parseDraft(json, '["monitor"]')).toEqual({
      ok: true,
      value: ['monitor'],
    })
    expect(parseDraft(json, '')).toEqual({ ok: false, reason: 'emptyJson' })
    expect(parseDraft(json, '{oops')).toEqual({
      ok: false,
      reason: 'invalidJson',
    })
  })

  describe('setting sections', () => {
    it('splits a tab by section and keeps undeclared items in their own block', () => {
      const settings = [
        setting({ key: 'wechat.pay.mchId', group: 'wechat', section: 'pay' }),
        setting({
          key: 'wechat.pay.mock',
          group: 'wechat',
          section: 'pay',
          valueType: 'BOOLEAN',
          value: true,
        }),
        setting({
          key: 'wechat.scanLogin.page',
          group: 'wechat',
          section: 'scanLogin',
        }),
        setting({ key: 'wechat.extra', group: 'wechat' }),
      ]

      const tab = buildSettingTabs(settings)[0]

      // section 顺序 = 首次出现顺序；未声明的项归到空串那一段
      expect(tab?.sections.map((section) => section.key)).toEqual(['pay', 'scanLogin', ''])
      expect(tab?.sections[0]?.items.map((item) => item.key)).toEqual([
        'wechat.pay.mchId',
        'wechat.pay.mock',
      ])
      // items 仍是全量，保存与脏计数逻辑不受影响
      expect(tab?.items).toHaveLength(4)
    })

    it('collapses everything into one unnamed section when no section is declared', () => {
      const settings = [
        setting({ key: 'storage.driver', group: 'storage' }),
        setting({
          key: 'storage.publicBaseUrl',
          group: 'storage',
          section: '   ',
        }),
      ]

      const tab = buildSettingTabs(settings)[0]

      expect(tab?.sections).toHaveLength(1)
      expect(tab?.sections[0]?.key).toBe('')
      expect(tab?.sections[0]?.items).toHaveLength(2)
    })
  })
})
