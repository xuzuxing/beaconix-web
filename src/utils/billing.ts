/** 计费相关的展示格式化（金额单位为分，时间来自后端 ISO 字符串） */
import dayjs from 'dayjs'

import type { Plan, PlanCycle, PlanTerm } from '@/api/types/billing'

/** 分 → ¥ 金额展示，如 2900 → ¥29.00 */
export function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

export type PlanTier = 'free' | 'pro' | 'team'

/** 先按套餐编码区分版本，未知套餐按价格回退，不依赖本地化名称。 */
export function planTier(plan: Pick<Plan, 'code' | 'price'> | null | undefined): PlanTier {
  const code = plan?.code.trim().toUpperCase()
  if (!plan || code === 'FREE') return 'free'
  if (code === 'TEAM') return 'team'
  if (code === 'PRO') return 'pro'
  return plan.price > 0 ? 'pro' : 'free'
}

export function planTagTheme(plan: Plan | null): 'primary' | 'default' | 'warning' {
  const themes = { free: 'primary', pro: 'warning', team: 'default' } as const
  return themes[planTier(plan)]
}

/** ISO 时间 → YYYY-MM-DD */
export function formatDate(value: string | null | undefined): string {
  return value ? dayjs(value).format('YYYY-MM-DD') : '—'
}

/** ISO 时间 → YYYY-MM-DD HH:mm */
export function formatDateTime(value: string | null | undefined): string {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
}

// ------------------------------------------------------------
// 计费周期档位（PlanTerm）
// ------------------------------------------------------------

/** 周期的固定展示顺序，与后端 `PlanCycle` 枚举一致 */
export const PLAN_CYCLES: readonly PlanCycle[] = ['MONTHLY', 'QUARTERLY', 'YEARLY']
const PLAN_CYCLE_SET: ReadonlySet<string> = new Set(PLAN_CYCLES)

/**
 * 周期的 i18n 文案键（中英文顶层 `common.planCycle.*`，用户侧与管理端共用）
 *
 * 后端 `OrderEntity.cycle` 为 nullable，且将来可能新增枚举值（如 `BIWEEKLY`），
 * 因此运行时做白名单校验，未知/缺失一律回退到 `common.planCycle.unknown`，
 * 避免把裸 i18n key 渲染到页面。
 */
export function planCycleLabelKey(cycle: PlanCycle | null | undefined): string {
  const label = cycle != null && PLAN_CYCLE_SET.has(cycle) ? cycle : 'unknown'
  return `common.planCycle.${label}`
}

/**
 * 套餐的启用档位。
 *
 * `terms` 只在套餐目录接口（`GET /plans`、`GET /admin/plans`）返回；
 * 订阅栈接口没有该字段，因此这里按空数组兜底。
 */
export function enabledTerms(plan: Pick<Plan, 'terms'> | null | undefined): PlanTerm[] {
  return (plan?.terms ?? []).filter((term) => term.enabled)
}

/** 最便宜的启用档位（价格相同取更短周期）；没有启用档时为 null */
export function cheapestTerm(plan: Pick<Plan, 'terms'> | null | undefined): PlanTerm | null {
  return enabledTerms(plan).reduce<PlanTerm | null>((cheapest, term) => {
    if (!cheapest) return term
    if (term.price !== cheapest.price) return term.price < cheapest.price ? term : cheapest
    return term.durationDays < cheapest.durationDays ? term : cheapest
  }, null)
}

/** 档位折合月均价（分），仅作展示参考：round(price / durationDays × 30) */
export function termMonthlyPrice(term: Pick<PlanTerm, 'price' | 'durationDays'>): number {
  if (!Number.isFinite(term.durationDays) || term.durationDays <= 0) return term.price
  return Math.round((term.price / term.durationDays) * 30)
}
