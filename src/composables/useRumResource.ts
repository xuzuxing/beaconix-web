import { onScopeDispose, ref, shallowRef, watch, type WatchSource } from 'vue'
import { permissionEpoch, sessionEpoch, workspaceEpoch } from '@/utils/access-context'

/** Request state is cleared synchronously on identity, workspace or dependency changes. */
export function useRumResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  sources: WatchSource[] = [],
) {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref(false)
  let sequence = 0
  let controller: AbortController | undefined
  async function reload() {
    const token = ++sequence
    controller?.abort()
    controller = new AbortController()
    data.value = null
    loading.value = true
    error.value = false
    try {
      const result = await load(controller.signal)
      if (token === sequence) data.value = result
    } catch {
      if (token === sequence) error.value = true
    } finally {
      if (token === sequence) loading.value = false
    }
  }
  watch([...sources, sessionEpoch, workspaceEpoch, permissionEpoch], () => void reload(), {
    immediate: true,
    flush: 'sync',
  })
  onScopeDispose(() => {
    sequence++
    controller?.abort()
    data.value = null
  })
  return { data, loading, error, reload }
}
