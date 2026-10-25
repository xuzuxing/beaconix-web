import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { usePermissionsStore } from '@/stores/modules/permissions'
export function useProjectAccess(projectId: MaybeRefOrGetter<string>) {
  const permissions = usePermissionsStore()
  const id = computed(() => toValue(projectId))
  watch(
    id,
    (value) => {
      void permissions.ensureProject(value)
    },
    { immediate: true },
  )
  const entry = computed(() => permissions.projects[id.value])
  const can = (action: string) => computed(() => permissions.canProject(id.value, action))
  return {
    entry,
    can,
    canRead: can('monitor.read'),
    canCheck: can('monitor.check'),
    canManage: can('monitor.manage'),
    canTestAlert: can('monitor.test-alert'),
  }
}
