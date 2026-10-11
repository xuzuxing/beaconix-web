import { ref } from 'vue'

import { listPersonalAccessTokens } from '@/api'
import type { PersonalAccessToken } from '@/api/types/personal-access-token'

/**
 * 当前用户的个人访问令牌列表。
 * 明文令牌只在创建响应里出现一次，因此列表只持有元信息。
 * 用请求序号丢弃过期响应，避免快速刷新时旧结果覆盖新状态。
 */
export function usePersonalAccessTokens() {
  const tokens = ref<PersonalAccessToken[]>([])
  const loading = ref(false)
  const error = ref('')
  /** 正在吊销的令牌 id */
  const pendingId = ref('')
  let request = 0

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''
    try {
      const result = await listPersonalAccessTokens()
      if (token !== request) return
      tokens.value = result ?? []
    } catch (cause) {
      if (token !== request) return
      tokens.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 串行执行吊销等一次性动作，避免重复提交 */
  async function act(id: string, action: () => Promise<unknown>) {
    if (pendingId.value) return
    pendingId.value = id
    try {
      await action()
    } finally {
      pendingId.value = ''
    }
  }

  return { tokens, loading, error, pendingId, load, act }
}
