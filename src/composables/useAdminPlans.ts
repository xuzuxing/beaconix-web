import { ref } from 'vue'

import { createAdminPlan, deleteAdminPlan, listAdminPlans, updateAdminPlan } from '@/api'
import type { AdminPlan, CreateAdminPlanParams, UpdateAdminPlanParams } from '@/api/types/admin'

/** 按 sortOrder 升序（同序时按 code），与用户侧套餐目录的展示顺序一致 */
function sortPlans(plans: AdminPlan[]): AdminPlan[] {
  return [...plans].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code),
  )
}

/**
 * 套餐配置的维护列表（仅 SUPER_ADMIN）。
 *
 * 与用户侧 `GET /plans` 的区别：这里包含停用套餐，并能写回配额 / 协议白名单 / 启用状态。
 * 所有写操作成功后重新拉取列表，避免本地状态与后端默认值不一致。
 */
export function useAdminPlans() {
  const plans = ref<AdminPlan[]>([])
  const loading = ref(false)
  const error = ref('')
  /** 表单提交中（新建或编辑） */
  const submitting = ref(false)
  /** 正在行内操作（启停 / 删除）的套餐 ID */
  const actingId = ref('')
  let request = 0

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''
    try {
      const result = await listAdminPlans()
      if (token !== request) return
      plans.value = sortPlans(Array.isArray(result) ? result : [])
    } catch (cause) {
      if (token !== request) return
      plans.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 新建套餐；成功返回 true（请求层已统一提示错误） */
  async function create(params: CreateAdminPlanParams): Promise<boolean> {
    submitting.value = true
    try {
      await createAdminPlan(params)
      await load()
      return true
    } catch {
      return false
    } finally {
      submitting.value = false
    }
  }

  /** 更新套餐（也用于启停：只传 `{ enabled }`） */
  async function update(planId: string, params: UpdateAdminPlanParams): Promise<boolean> {
    submitting.value = true
    actingId.value = planId
    try {
      await updateAdminPlan(planId, params)
      await load()
      return true
    } catch {
      return false
    } finally {
      submitting.value = false
      actingId.value = ''
    }
  }

  /** 删除套餐；仍被订单或订阅引用时后端会拒绝（如 409） */
  async function remove(planId: string): Promise<boolean> {
    actingId.value = planId
    try {
      await deleteAdminPlan(planId)
      plans.value = plans.value.filter((plan) => plan.id !== planId)
      return true
    } catch {
      return false
    } finally {
      actingId.value = ''
    }
  }

  return {
    plans,
    loading,
    error,
    submitting,
    actingId,
    load,
    create,
    update,
    remove,
  }
}
