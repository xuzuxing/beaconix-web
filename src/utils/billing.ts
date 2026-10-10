/** 计费相关的展示格式化（金额单位为分，时间来自后端 ISO 字符串） */
import dayjs from 'dayjs'

import type { Plan } from '@/api/types/billing'

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
