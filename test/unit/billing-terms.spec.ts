import { expect, it } from 'vitest'

import type { Plan, PlanCycle, PlanTerm } from '@/api/types/billing'
import {
  cheapestTerm,
  enabledTerms,
  PLAN_CYCLES,
  planCycleLabelKey,
  termMonthlyPrice,
} from '@/utils/billing'

function term(overrides: Partial<PlanTerm> & Pick<PlanTerm, 'cycle'>): PlanTerm {
  return {
    id: `term-${overrides.cycle}`,
    planId: 'plan-1',
    durationDays: 30,
    price: 2900,
    enabled: true,
    sortOrder: 1,
    ...overrides,
  }
}

function plan(terms?: PlanTerm[]): Pick<Plan, 'terms'> {
  return { terms }
}

it('keeps the cycle order aligned with the backend enum', () => {
  expect(PLAN_CYCLES).toEqual(['MONTHLY', 'QUARTERLY', 'YEARLY'])
  expect(planCycleLabelKey('QUARTERLY')).toBe('common.planCycle.QUARTERLY')
})

it('falls back to a readable label when the cycle is missing or unknown', () => {
  // 后端 OrderEntity.cycle 是 nullable：引入周期档之前的老订单没有该值
  expect(planCycleLabelKey(null)).toBe('common.planCycle.unknown')
  expect(planCycleLabelKey(undefined)).toBe('common.planCycle.unknown')
  // 后端将来新增周期（如 BIWEEKLY）时，不能把裸 i18n key 渲染到页面
  expect(planCycleLabelKey('BIWEEKLY' as PlanCycle)).toBe('common.planCycle.unknown')
  expect(planCycleLabelKey('' as PlanCycle)).toBe('common.planCycle.unknown')
})

it('filters disabled terms and tolerates a plan without terms', () => {
  expect(
    enabledTerms(
      plan([
        term({ cycle: 'MONTHLY' }),
        term({ cycle: 'YEARLY', enabled: false, durationDays: 365 }),
      ]),
    ).map((item) => item.cycle),
  ).toEqual(['MONTHLY'])

  // 订阅栈接口不返回 terms，必须按空数组处理而不是崩
  expect(enabledTerms(plan())).toEqual([])
  expect(enabledTerms(null)).toEqual([])
})

it('picks the cheapest enabled term, breaking ties by shorter cycle', () => {
  expect(
    cheapestTerm(
      plan([
        term({ cycle: 'MONTHLY', price: 2900 }),
        term({ cycle: 'YEARLY', price: 29000, durationDays: 365 }),
      ]),
    )?.cycle,
  ).toBe('MONTHLY')

  // 年付比月付便宜时，起价应取年付
  expect(
    cheapestTerm(
      plan([
        term({ cycle: 'MONTHLY', price: 9900 }),
        term({ cycle: 'YEARLY', price: 5000, durationDays: 365 }),
      ]),
    )?.cycle,
  ).toBe('YEARLY')

  // 同价取更短周期，避免把 365 天标成「¥29 起 / 年」
  expect(
    cheapestTerm(
      plan([
        term({ cycle: 'YEARLY', price: 2900, durationDays: 365 }),
        term({ cycle: 'MONTHLY', price: 2900 }),
      ]),
    )?.cycle,
  ).toBe('MONTHLY')

  // 停用档不参与比价
  expect(
    cheapestTerm(
      plan([
        term({ cycle: 'MONTHLY', price: 2900, enabled: false }),
        term({ cycle: 'QUARTERLY', price: 7900, durationDays: 90 }),
      ]),
    )?.cycle,
  ).toBe('QUARTERLY')

  expect(cheapestTerm(plan([]))).toBeNull()
})

it('converts a term price into a monthly equivalent in cents', () => {
  expect(termMonthlyPrice({ price: 2900, durationDays: 30 })).toBe(2900)
  expect(termMonthlyPrice({ price: 7900, durationDays: 90 })).toBe(2633)
  expect(termMonthlyPrice({ price: 29000, durationDays: 365 })).toBe(2384)
  // 异常时长不允许出现 NaN / Infinity
  expect(termMonthlyPrice({ price: 1000, durationDays: 0 })).toBe(1000)
})
