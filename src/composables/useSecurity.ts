import { ref } from 'vue'

import { getTwoFactorStatus } from '@/api'
import type { TwoFactorStatus } from '@/api/types'

/**
 * 两步验证状态：进入安全页时拉取一次，开启 / 重置 / 关闭等动作成功后由页面重新加载。
 * 与 useTeamApiKeys 相同，用请求序号丢弃过期响应，避免快速切换时旧结果覆盖新状态。
 */
export function useSecurity() {
  const status = ref<TwoFactorStatus | null>(null)
  const loading = ref(false)
  const error = ref('')
  let request = 0

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''
    try {
      const result = await getTwoFactorStatus()
      if (token !== request) return
      status.value = result
    } catch (cause) {
      if (token !== request) return
      status.value = null
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  return { status, loading, error, load }
}
