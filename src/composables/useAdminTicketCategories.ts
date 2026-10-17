import { ref } from 'vue'

import {
  createTicketCategory,
  deleteTicketCategory,
  listTicketCategories,
  updateTicketCategory,
} from '@/api'
import type {
  CreateTicketCategoryParams,
  TicketCategory,
  UpdateTicketCategoryParams,
} from '@/api/types/ticket'

/**
 * 工单分类的维护列表（仅 SUPER_ADMIN）。
 *
 * 注意：分类的读接口只有用户侧 `GET /tickets/categories`，它只返回启用中的分类，
 * 因此停用（isActive=false）的分类不会再出现在列表里——页面需要把这一点写清楚。
 */
export function useAdminTicketCategories() {
  const categories = ref<TicketCategory[]>([])
  const loading = ref(false)
  const error = ref('')
  const creating = ref(false)
  /** 正在提交的分类 ID（用于行内按钮的 loading） */
  const actingId = ref('')
  let request = 0

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''
    try {
      const result = await listTicketCategories()
      if (token !== request) return
      categories.value = Array.isArray(result) ? result : []
    } catch (cause) {
      if (token !== request) return
      categories.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 新建分类；成功返回 true（请求层已统一提示错误） */
  async function create(params: CreateTicketCategoryParams): Promise<boolean> {
    creating.value = true
    try {
      await createTicketCategory(params)
      await load()
      return true
    } catch {
      return false
    } finally {
      creating.value = false
    }
  }

  /** 更新或停用分类 */
  async function update(categoryId: string, params: UpdateTicketCategoryParams): Promise<boolean> {
    actingId.value = categoryId
    try {
      await updateTicketCategory(categoryId, params)
      await load()
      return true
    } catch {
      return false
    } finally {
      actingId.value = ''
    }
  }

  /** 删除未被引用的分类；仍被工单引用时后端返回 409 */
  async function remove(categoryId: string): Promise<boolean> {
    actingId.value = categoryId
    try {
      await deleteTicketCategory(categoryId)
      categories.value = categories.value.filter((category) => category.id !== categoryId)
      return true
    } catch {
      return false
    } finally {
      actingId.value = ''
    }
  }

  return { categories, loading, error, creating, actingId, load, create, update, remove }
}
