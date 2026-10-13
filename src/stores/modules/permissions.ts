import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getOrganizationPermissions, getProjectPermissions } from '@/api/modules/permissions'
import type {
  OrganizationPermissions,
  PermissionState,
  ProjectPermissions,
} from '@/api/types/permissions'
import { ApiError } from '@/utils/request'
import {
  accessContext,
  invalidatePermissions,
  isCurrentContext,
  sessionEpoch,
  workspaceEpoch,
} from '@/utils/access-context'

interface Entry<T> {
  state: PermissionState
  data: T | null
  error: string
}
export const usePermissionsStore = defineStore('permissions', () => {
  const organizations = ref<Record<string, Entry<OrganizationPermissions>>>({})
  const projects = ref<Record<string, Entry<ProjectPermissions>>>({})
  const pending = new Map<string, Promise<unknown>>()
  let generation = 0
  function reset() {
    generation++
    pending.clear()
    organizations.value = {}
    projects.value = {}
  }
  function invalidate() {
    reset()
    invalidatePermissions()
  }
  async function load<T extends OrganizationPermissions | ProjectPermissions>(
    kind: 'organization' | 'project',
    id: string,
    force: boolean,
  ): Promise<T | null> {
    if (!id) return null
    const key = `${kind}:${id}`
    const records = (kind === 'organization' ? organizations.value : projects.value) as Record<
      string,
      Entry<T>
    >
    if (pending.has(key)) return pending.get(key) as Promise<T | null>
    const previous = records[id]
    if (!force && previous?.state === 'ready') return previous.data
    const token = generation
    const context = accessContext()
    if (!previous?.data) records[id] = { state: 'loading', data: null, error: '' }
    const work = (async () => {
      try {
        const data = (await (kind === 'organization'
          ? getOrganizationPermissions(id)
          : getProjectPermissions(id))) as T
        if (token !== generation || !isCurrentContext(context)) return null
        const capabilityKeys =
          kind === 'organization'
            ? [
                'manageOrganization',
                'manageProjectPermissions',
                'inviteMembers',
                'grantOrganizationAdmin',
              ]
            : [
                'monitor.read',
                'monitor.check',
                'monitor.manage',
                'monitor.test-alert',
                'rule.manage',
              ]
        if (
          !data ||
          !data.capabilities ||
          capabilityKeys.some(
            (key) => typeof (data.capabilities as Record<string, unknown>)[key] !== 'boolean',
          ) ||
          !['ALL_PROJECTS', 'SELECTED_PROJECTS'].includes(data.accessMode) ||
          data.organizationId === undefined ||
          (kind === 'organization' && data.organizationId !== id) ||
          (kind === 'project' &&
            (!('projectId' in data) ||
              data.projectId !== id ||
              !['VIEWER', 'MEMBER', 'ADMIN'].includes(data.effectiveRole)))
        ) {
          throw new Error('Invalid permission response')
        }
        if (previous?.data && JSON.stringify(previous.data) !== JSON.stringify(data)) {
          reset()
          invalidatePermissions()
        }
        const current = (kind === 'organization' ? organizations.value : projects.value) as Record<
          string,
          Entry<T>
        >
        current[id] = { state: 'ready', data, error: '' }
        return data
      } catch (error) {
        if (token !== generation || !isCurrentContext(context)) return null
        if (previous?.data) {
          reset()
          invalidatePermissions()
        }
        const current = (kind === 'organization' ? organizations.value : projects.value) as Record<
          string,
          Entry<T>
        >
        current[id] = {
          state:
            error instanceof ApiError && [403, 404].includes(error.status ?? 0)
              ? 'denied'
              : 'error',
          data: null,
          error: error instanceof Error ? error.message : '',
        }
        return null
      } finally {
        if (token === generation) pending.delete(key)
      }
    })()
    pending.set(key, work)
    return work
  }
  const ensureOrganization = (id: string, force = false) =>
    load<OrganizationPermissions>('organization', id, force)
  const ensureProject = (id: string, force = false) =>
    load<ProjectPermissions>('project', id, force)
  const canOrganization = (
    id: string,
    key: keyof OrganizationPermissions['capabilities'] = 'manageOrganization',
  ) =>
    organizations.value[id]?.state === 'ready' &&
    organizations.value[id]?.data?.capabilities[key] === true
  const canProject = (id: string, action: string) =>
    projects.value[id]?.state === 'ready' && projects.value[id]?.data?.capabilities[action] === true
  watch(sessionEpoch, reset, { flush: 'sync' })
  watch(
    workspaceEpoch,
    () => {
      generation++
      pending.clear()
      projects.value = {}
    },
    { flush: 'sync' },
  )
  return {
    organizations,
    projects,
    ensureOrganization,
    ensureProject,
    canOrganization,
    canProject,
    reset,
    invalidate,
  }
})
