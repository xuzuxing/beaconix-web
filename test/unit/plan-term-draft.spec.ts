import { describe, expect, it } from 'vitest'

import type { PlanTerm } from '@/api/types/billing'
import { toPlanTermDraft, toPlanTermParams } from '@/utils/admin-presenter'

/**
 * 管理端套餐编辑里，计费周期在「表单草稿（元）」与「接口参数（分）」之间来回转换。
 * 重点是微信商品 ID：编辑时要能回填，清空时要真的提交 null。
 */
function term(overrides: Partial<PlanTerm> = {}): PlanTerm {
  return {
    id: 'term-1',
    planId: 'plan-1',
    cycle: 'MONTHLY',
    durationDays: 30,
    price: 2900,
    enabled: true,
    sortOrder: 1,
    wechatProductId: null,
    ...overrides,
  }
}

describe('toPlanTermDraft', () => {
  it('converts cents to yuan and keeps the WeChat product id', () => {
    expect(toPlanTermDraft(term({ wechatProductId: 'wx_pro_monthly' }))).toEqual({
      cycle: 'MONTHLY',
      durationDays: 30,
      priceYuan: 29,
      enabled: true,
      wechatProductId: 'wx_pro_monthly',
    })
  })

  it('falls back to an empty input for legacy terms without the field', () => {
    const draft = toPlanTermDraft(term({ wechatProductId: undefined }))

    expect(draft.wechatProductId).toBe('')
  })
})

describe('toPlanTermParams', () => {
  const draft = {
    cycle: 'QUARTERLY' as const,
    durationDays: 90,
    priceYuan: 79,
    enabled: true,
    wechatProductId: ' wx_pro_quarterly ',
  }

  it('converts yuan to cents, trims the product id and derives sortOrder', () => {
    expect(toPlanTermParams(draft)).toEqual({
      cycle: 'QUARTERLY',
      durationDays: 90,
      price: 7900,
      enabled: true,
      sortOrder: 2,
      wechatProductId: 'wx_pro_quarterly',
    })
  })

  it('submits null when the product id input is cleared', () => {
    expect(toPlanTermParams({ ...draft, wechatProductId: '   ' }).wechatProductId).toBeNull()
  })

  it('rounds fractional yuan to whole cents', () => {
    expect(toPlanTermParams({ ...draft, priceYuan: 29.99 }).price).toBe(2999)
  })

  it('never sends NaN for an emptied numeric input', () => {
    const params = toPlanTermParams({
      ...draft,
      durationDays: Number.NaN,
      priceYuan: Number.NaN,
    })

    expect(params.durationDays).toBe(0)
    expect(params.price).toBe(0)
  })
})
