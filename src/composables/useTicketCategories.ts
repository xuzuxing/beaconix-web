import { computed, ref } from 'vue'

import { listTicketCategories } from '@/api'
import type { TicketCategory } from '@/api/types/ticket'

/**
 * 提交工单时可选的分类（GET /tickets/categories，后端只返回启用项）。
 * 同一页面内（列表筛选 + 提交弹窗）复用一份实例，避免重复请求。
 */
export function useTicketCategories() {
  const categories = ref<TicketCategory[]>([])
  const loading = ref(false)
  const error = ref('')
  let request = 0
  let loaded = false

  async function load(force = false) {
    if (loaded && !force) return
    const token = ++request
    loading.value = true
    error.value = ''
    try {
      const result = await listTicketCategories()
      if (token !== request) return
      categories.value = Array.isArray(result) ? result : []
      loaded = true
    } catch (cause) {
      if (token !== request) return
      categories.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  const options = computed(() =>
    categories.value.map((category) => ({
      label: category.name,
      value: category.id,
    })),
  )

  function nameOf(categoryId: string | null | undefined): string {
    if (!categoryId) return ''
    return categories.value.find((category) => category.id === categoryId)?.name ?? ''
  }

  return { categories, options, loading, error, load, nameOf }
}
