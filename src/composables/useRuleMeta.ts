import { ref } from 'vue'
import { getRuleMeta } from '@/api'
import type { RuleMeta } from '@/api/types/rule'

/**
 * 规则字段 / 操作符元数据（`GET /rule-meta`）。
 * 这是后端 FIELD_META 的下发副本，静态公共数据：同一会话内只拉一次，失败可重试。
 */
const meta = ref<RuleMeta | null>(null)
const error = ref('')
const loading = ref(false)
let pending: Promise<RuleMeta | null> | null = null

export function useRuleMeta() {
  async function load() {
    if (meta.value) return meta.value
    loading.value = true
    pending ??= getRuleMeta()
      .then((result) => {
        meta.value = result
        error.value = ''
        return result
      })
      .catch((cause) => {
        error.value = cause instanceof Error ? cause.message : 'rule-meta failed'
        return null
      })
      .finally(() => {
        loading.value = false
        pending = null
      })
    return pending
  }

  return { meta, error, loading, load }
}
