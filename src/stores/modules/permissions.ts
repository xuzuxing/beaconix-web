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
  /** 每个 key 最近一次成功加载的时间，用于 force 请求的新鲜度窗口 */
  const loadedAt = new Map<string, number>()
  let generation = 0
  function reset() {
    generation++
    pending.clear()
    loadedAt.clear()
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
    maxAgeMs = 0,
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
    // 强刷也允许在一个短窗口内复用刚取到的能力：导航、切换与重验常在同一时刻多层
    // 触发同一份 /my-permissions。maxAgeMs 为 0（默认）时保持“强制必刷”的原有语义。
    if (force && maxAgeMs > 0 && previous?.state === 'ready') {
      const refreshedAt = loadedAt.get(key)
      if (refreshedAt !== undefined && Date.now() - refreshedAt <= maxAgeMs) return previous.data
    }
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
        loadedAt.set(key, Date.now())
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
        loadedAt.delete(key)
        return null
      } finally {
        if (token === generation) pending.delete(key)
      }
    })()
    pending.set(key, work)
    return work
  }
  const ensureOrganization = (id: string, force = false, maxAgeMs = 0) =>
    load<OrganizationPermissions>('organization', id, force, maxAgeMs)
  const ensureProject = (id: string, force = false, maxAgeMs = 0) =>
    load<ProjectPermissions>('project', id, force, maxAgeMs)
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
