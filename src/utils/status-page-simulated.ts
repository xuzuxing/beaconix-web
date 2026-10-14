import type { PublicMonitorAvailability, PublicStatusPage } from '@/api/types/status-page'

/**
 * 公开页热力图的**临时演示数据**。
 *
 * 后端还没有在公开接口的 `monitors[]` 里返回 `availability`，这里在拿到响应后补一份
 * 确定性的模拟值，先把热力图的观感调出来。后端补上该数据组后，删掉本文件与
 * `views/status-pages/PublicStatusPageView.vue` 里的调用即可（真实数据不会被覆盖）。
 *
 * 开关（`VITE_STATUS_PAGE_MOCK`，见 .env）：
 * - 不设置：开发环境默认开启
 * - '0' / 'false'：关闭
 * - '1' / 'true'：在非开发构建（如 build:test 部署预览）中也开启
 */

const SIMULATED_DAYS = 3
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** FNV-1a：把监控项 id 映射成稳定的种子，保证同一个监控每次生成的图形一致 */
function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 线性同余随机数（与 config/monitoring.ts 的演示数据同款），保证结果可复现 */
function createRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export function isStatusPageMockEnabled() {
  const flag = (import.meta.env.VITE_STATUS_PAGE_MOCK ?? '').trim()
  if (flag === '0' || flag === 'false') return false
  if (flag === '1' || flag === 'true') return true
  return Boolean(import.meta.env.DEV)
}

/**
 * 近 3 天 × 24 小时的模拟可用率：
 * 白天平稳、凌晨与晚间波动更大，并留出约 4% 没有数据的小时（灰格）。
 */
export function buildSimulatedAvailability(
  seed: string,
  now = new Date(),
): PublicMonitorAvailability {
  const random = createRandom(hashString(seed))
  const days: string[] = []
  const cells: [number, number, number][] = []
  const unavailableCells: [number, number][] = []
  let worst: { day: string; hour: number; value: number } | null = null

  for (let dayIndex = 0; dayIndex < SIMULATED_DAYS; dayIndex += 1) {
    const date = new Date(now)
    date.setDate(date.getDate() - (SIMULATED_DAYS - 1 - dayIndex))
    const label = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    days.push(label)

    for (const hour of HOURS) {
      if (random() < 0.04) {
        unavailableCells.push([hour, dayIndex])
        continue
      }
      const unstable = hour < 7 || hour > 21
      const value = Number((99.995 - random() * (unstable ? 1.4 : 0.35)).toFixed(3))
      cells.push([hour, dayIndex, value])
      if (!worst || value < worst.value) {
        worst = { day: label, hour, value }
      }
    }
  }

  return { days, hours: HOURS, cells, unavailableCells, worst, simulated: true }
}

/**
 * 给公开页响应补上演示数据：只补后端没返回的监控项，已有的真实数据原样保留；
 * 开关关闭或没有监控项时原样返回（不做拷贝）。
 */
export function withSimulatedAvailability(page: PublicStatusPage): PublicStatusPage {
  if (!isStatusPageMockEnabled() || !page.monitors.length) return page
  return {
    ...page,
    monitors: page.monitors.map((monitor) =>
      monitor.availability
        ? monitor
        : { ...monitor, availability: buildSimulatedAvailability(monitor.id) },
    ),
  }
}
