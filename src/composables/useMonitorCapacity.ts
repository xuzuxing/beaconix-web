import { computed, onActivated, onDeactivated, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getMonitorCapacity, listMonitors, listProjects, selectMonitorCapacity } from '@/api'
import type { Monitor } from '@/api/types'
import type { MonitorCapacity } from '@/api/types/billing'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  sessionEpoch,
} from '@/utils/access-context'

export interface CapacityMonitor extends Monitor {
  projectName: string
}

export function useMonitorCapacity(orgId: Ref<string>) {
  const { t } = useI18n()
  const { canManage } = useOrganizationRole()
  const permissions = usePermissionsStore()
  const capacity = ref<MonitorCapacity | null>(null)
  const monitors = ref<CapacityMonitor[]>([])
  const selected = ref<string[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const monitorsError = ref('')
  let generation = 0
  let controller: AbortController | undefined
  let active = true
  onActivated(() => {
    active = true
  })
  onDeactivated(() => {
    active = false
  })
  const dirty = computed(() => {
    const original = capacity.value?.selectedMonitorIds ?? []
    return (
      selected.value.length !== original.length ||
      selected.value.some((id) => !original.includes(id))
    )
  })

  async function load() {
    const token = ++generation
    const id = orgId.value
    const context = accessContext()
    controller?.abort()
    const active = new AbortController()
    controller = active
    const current = () =>
      token === generation && id === orgId.value && canManage.value && isCurrentContext(context)
    error.value = ''
    monitorsError.value = ''
    if (!id || !canManage.value) {
      capacity.value = null
      monitors.value = []
      selected.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result = await getMonitorCapacity(id)
      if (!current()) return
      capacity.value = result
      selected.value = [...result.selectedMonitorIds]
      monitors.value = []
      if (!result.cycleId) return
      try {
        const projects = await listProjects(id)
        if (!current()) return
        const results = await Promise.allSettled(
          projects.map(async (project) => {
            const rows = await listMonitors(project.id, { signal: active.signal })
            return rows.map((row) => ({ ...row, projectName: project.name }))
          }),
        )
        if (!current()) return
        monitors.value = results.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : [],
        )
        if (results.some((result) => result.status === 'rejected'))
          monitorsError.value = t('monitorCapacity.monitorsFailed')
      } catch {
        if (current()) monitorsError.value = t('monitorCapacity.monitorsFailed')
      }
    } catch (cause) {
      if (!current()) return
      capacity.value = null
      error.value = cause instanceof Error ? cause.message : t('monitorCapacity.loadFailed')
    } finally {
      if (token === generation) loading.value = false
    }
  }

  async function save() {
    const snapshot = capacity.value
    if (
      !canManage.value ||
      !snapshot?.cycleId ||
      saving.value ||
      loading.value ||
      monitorsError.value ||
      selected.value.length > snapshot.limit
    )
      return false
    const token = generation
    const id = orgId.value
    const context = accessContext()
    const current = () =>
      token === generation && id === orgId.value && canManage.value && isCurrentContext(context)
    const monitorIds = [...selected.value]
    saving.value = true
    error.value = ''
    try {
      await permissions.ensureOrganization(id, true)
      if (!current() || !permissions.canOrganization(id)) return false
      const result = await selectMonitorCapacity(id, { cycleId: snapshot.cycleId, monitorIds })
      if (!current()) return false
      capacity.value = result
      selected.value = [...result.selectedMonitorIds]
      return true
    } catch (cause) {
      if (!current()) return false
      // 周期、名额或资源可能已变化。重新读取，不重试旧选择。
      const message = cause instanceof Error ? cause.message : t('monitorCapacity.saveFailed')
      await load()
      if (id === orgId.value && canManage.value && isCurrentContext(context))
        error.value = `${t('monitorCapacity.selectionRefreshed')} ${message}`
      return false
    } finally {
      if (id === orgId.value && isCurrentContext(context)) saving.value = false
    }
  }

  watch(
    [orgId, canManage, permissionEpoch, sessionEpoch],
    () => {
      capacity.value = null
      monitors.value = []
      selected.value = []
      saving.value = false
      void load()
    },
    { immediate: true, flush: 'sync' },
  )

  const timer = setInterval(() => {
    if (
      canManage.value &&
      active &&
      !dirty.value &&
      !saving.value &&
      !loading.value &&
      document.visibilityState === 'visible'
    )
      void load()
  }, 60_000)
  onScopeDispose(() => {
    generation++
    controller?.abort()
    clearInterval(timer)
  })

  return {
    capacity,
    monitors,
    selected,
    loading,
    saving,
    error,
    monitorsError,
    canManage,
    dirty,
    load,
    save,
  }
}
