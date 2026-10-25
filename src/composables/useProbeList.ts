import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { listProbes } from '@/api/modules/probe'
import type { TenantProbe } from '@/api/types/probe'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  sessionEpoch,
} from '@/utils/access-context'
import { withoutProbeSecret } from '@/utils/probe-presenter'

export function useProbeList(scope: MaybeRefOrGetter<string>) {
  const permissions = usePermissionsStore()
  const probes = ref<TenantProbe[]>([])
  const loading = ref(false)
  const error = ref('')
  const allowed = computed(() => permissions.canOrganization(toValue(scope)))
  let generation = 0
  let controller: AbortController | undefined
  async function load() {
    const token = ++generation
    const orgId = toValue(scope)
    const context = accessContext()
    controller?.abort()
    controller = new AbortController()
    error.value = ''
    if (!orgId || !allowed.value) {
      probes.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result = await listProbes(orgId, { signal: controller.signal })
      if (token === generation && isCurrentContext(context) && allowed.value)
        probes.value = result.map(withoutProbeSecret)
    } catch (cause) {
      if (token === generation && isCurrentContext(context)) {
        probes.value = []
        error.value = cause instanceof Error ? cause.message : 'Failed to load probes'
      }
    } finally {
      if (token === generation) loading.value = false
    }
  }
  watch(
    [() => toValue(scope), allowed, permissionEpoch, sessionEpoch],
    () => {
      probes.value = []
      void load()
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })
  return { probes, loading, error, allowed, load }
}
