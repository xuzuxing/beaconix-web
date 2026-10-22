import { ref } from 'vue'

import { listOrderRefunds } from '@/api'
import type { Refund } from '@/api/types/refund'
import { latestRefund } from '@/utils/refund'

/**
 * 订单 → 退款单列表的客户端缓存。
 *
 * 后端没有批量接口（一单一退，通常每单 0 或 1 条），因此按订单并发拉取；
 * 单条失败不影响其它订单，避免一个 403 让整页退款状态消失。
 * 每次批量加载都会作废上一轮的迟到响应，切换团队或刷新列表时不会串数据。
 */
export function useOrderRefunds() {
  const byOrder = ref<Record<string, Refund[]>>({})
  let generation = 0

  /** 批量加载指定订单的退款单；结果整体替换缓存 */
  async function loadMany(orderIds: readonly string[]) {
    const token = ++generation
    const results = await Promise.all(
      orderIds.map(async (orderId) => {
        try {
          const refunds = await listOrderRefunds(orderId)
          return [orderId, Array.isArray(refunds) ? refunds : []] as const
        } catch {
          // 请求层已统一提示；单个订单读不到时按「无退款记录」处理
          return [orderId, [] as Refund[]] as const
        }
      }),
    )
    if (token !== generation) return

    const next: Record<string, Refund[]> = {}
    for (const [orderId, refunds] of results) next[orderId] = refunds
    byOrder.value = next
  }

  /** 只刷新单个订单的退款单（提交申请、进度终态后调用） */
  async function refresh(orderId: string) {
    const token = ++generation
    try {
      const refunds = await listOrderRefunds(orderId)
      if (token !== generation) return
      byOrder.value = { ...byOrder.value, [orderId]: Array.isArray(refunds) ? refunds : [] }
    } catch {
      // 保留旧数据，等下一次整体刷新
    }
  }

  /** 该订单最新的一条退款单（没有退款记录时为 null） */
  function latest(orderId: string): Refund | null {
    return latestRefund(byOrder.value[orderId])
  }

  function clear() {
    generation++
    byOrder.value = {}
  }

  return { byOrder, loadMany, refresh, latest, clear }
}
