import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  sessionEpoch,
} from '@/utils/access-context'

/** All probe writes revalidate organization authority before issuing the mutation. */
export function useProbeActions(scope: MaybeRefOrGetter<string>) {
  const permissions = usePermissionsStore()
  const busy = ref('')
  const error = ref('')
  let generation = 0
  watch(
    [() => toValue(scope), permissionEpoch, sessionEpoch],
    () => {
      generation++
      busy.value = ''
      error.value = ''
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
  })
  async function run<T>(
    key: string,
    action: (orgId: string) => Promise<T>,
  ): Promise<T | undefined> {
    const orgId = toValue(scope)
    if (busy.value || !orgId || !permissions.canOrganization(orgId)) return
    const token = generation
    const context = accessContext()
    busy.value = key
    error.value = ''
    const current = () =>
      token === generation &&
      isCurrentContext(context) &&
      orgId === toValue(scope) &&
      permissions.canOrganization(orgId)
    try {
      await permissions.ensureOrganization(orgId, true)
      if (!current()) return
      const result = await action(orgId)
      return current() ? result : undefined
    } catch (cause) {
      if (current()) error.value = cause instanceof Error ? cause.message : 'Probe action failed'
    } finally {
      if (token === generation) busy.value = ''
    }
  }
  return { busy, error, run }
}
