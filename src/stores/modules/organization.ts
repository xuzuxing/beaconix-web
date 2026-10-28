import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { usePermissionsStore } from './permissions'
import {
  invalidateWorkspace,
  permissionEpoch,
  sessionEpoch,
  workspaceEpoch,
} from '@/utils/access-context'

import {
  createProject as createProjectRequest,
  getSubscriptionStack,
  leaveOrganization as leaveOrganizationRequest,
  listOrganizations,
  listProjects,
} from '@/api'
import type { CreateProjectParams, Organization, Project } from '@/api/types'
import type { Plan, SubscriptionStack } from '@/api/types/billing'

/**
 * 工作区状态：当前团队（组织）与当前项目。
 * - 团队列表来自 GET /organizations
 * - 项目列表来自 GET /organizations/{orgId}/projects
 * - 当前团队套餐来自 GET /organizations/{orgId}/subscription（顶栏与概览页共用）
 * 只持久化两个 id，列表在需要时重新拉取，避免缓存过期数据。
 */
export const useOrganizationStore = defineStore(
  'organization',
  () => {
    const organizations = ref<Organization[]>([])
    const currentOrganizationId = ref('')
    const projects = ref<Project[]>([])
    const currentProjectId = ref('')
    const subscription = ref<SubscriptionStack | null>(null)
    const workspaceRevision = ref(0)
    const workspaceState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
    const workspaceError = ref('')
    const permissions = usePermissionsStore()
    let organizationsRequest = 0
    let projectsRequest = 0
    let subscriptionRequest = 0

    const currentOrganization = computed(
      () => organizations.value.find((item) => item.id === currentOrganizationId.value) ?? null,
    )

    const currentProject = computed(
      () => projects.value.find((item) => item.id === currentProjectId.value) ?? null,
    )

    /** Null can mean unreadable/unloaded; only a known subscription identifies a plan. */
    const currentPlan = computed<Plan | null>(() => subscription.value?.effectivePlan ?? null)

    /** 生效订阅的到期时间：取订阅栈里 isEffective 的那条 */
    const currentPlanExpiresAt = computed(
      () => subscription.value?.stack.find((entry) => entry.isEffective)?.expiresAt ?? null,
    )

    /** 拉取当前团队的订阅栈；切换团队与套餐升级成功后调用 */
    async function loadSubscription(orgId = currentOrganizationId.value) {
      const request = ++subscriptionRequest
      if (!orgId || !permissions.canOrganization(orgId)) {
        subscription.value = null
        return null
      }

      try {
        const result = await getSubscriptionStack(orgId)
        if (request !== subscriptionRequest || orgId !== currentOrganizationId.value)
          return subscription.value
        subscription.value = result
        return subscription.value
      } catch (cause) {
        if (request === subscriptionRequest && orgId === currentOrganizationId.value)
          subscription.value = null
        throw cause
      }
    }

    /** 拉取当前用户的团队列表；若已选团队不在列表中则回落到第一个 */
    async function loadOrganizations() {
      const request = ++organizationsRequest
      const revision = workspaceRevision.value
      const result = await listOrganizations()
      if (request !== organizationsRequest || revision !== workspaceRevision.value)
        return organizations.value
      organizations.value = result

      const exists = organizations.value.some((item) => item.id === currentOrganizationId.value)
      if (!exists) {
        currentOrganizationId.value = organizations.value[0]?.id ?? ''
        projects.value = []
        currentProjectId.value = ''
        subscription.value = null
      }

      return organizations.value
    }

    /** 拉取指定团队的项目列表；若已选项目不在列表中则回落到第一个 */
    async function loadProjects(orgId = currentOrganizationId.value) {
      const request = ++projectsRequest
      const revision = workspaceRevision.value
      if (orgId !== currentOrganizationId.value) return projects.value
      if (!orgId) {
        projects.value = []
        currentProjectId.value = ''
        return projects.value
      }
      const authority = await permissions.ensureOrganization(orgId)
      if (!authority || revision !== workspaceRevision.value) return projects.value
      const result = await listProjects(orgId)
      if (
        request !== projectsRequest ||
        revision !== workspaceRevision.value ||
        orgId !== currentOrganizationId.value
      )
        return projects.value
      projects.value = result

      const exists = projects.value.some((item) => item.id === currentProjectId.value)
      if (!exists) {
        currentProjectId.value = projects.value[0]?.id ?? ''
      }
      if (currentProjectId.value) await permissions.ensureProject(currentProjectId.value)
      return projects.value
    }

    /** 切换团队，并重新加载该团队的项目与套餐 */
    async function switchOrganization(id: string) {
      if (id === currentOrganizationId.value) return
      workspaceRevision.value++
      invalidateWorkspace()
      permissions.reset()
      currentOrganizationId.value = id
      currentProjectId.value = ''
      projects.value = []
      subscription.value = null
      await loadWorkspace()
    }

    async function switchProject(id: string) {
      if (!projects.value.some((project) => project.id === id)) return
      if (id === currentProjectId.value) return
      workspaceRevision.value++
      invalidateWorkspace()
      currentProjectId.value = id
      await permissions.ensureProject(id, true)
    }

    /**
     * 在当前团队新建项目：成功后并入本地列表并切到该项目。
     * 团队在创建过程中被切走时不再污染新团队的工作区。
     */
    async function createProject(payload: CreateProjectParams) {
      const orgId = currentOrganizationId.value
      if (!orgId) throw new Error('No organization selected')
      const project = await createProjectRequest(orgId, payload)
      if (orgId !== currentOrganizationId.value) return project
      projects.value = [...projects.value, project]
      await switchProject(project.id)
      return project
    }

    /**
     * 退出组织（加入的组织）：成功后从列表移除；若退出的是当前组织，
     * 切回默认（第一个）组织并重载工作区，避免停留在已无权限的上下文。
     */
    async function leaveOrganization(orgId: string) {
      await leaveOrganizationRequest(orgId)
      const wasCurrent = orgId === currentOrganizationId.value
      organizations.value = organizations.value.filter((org) => org.id !== orgId)

      if (!wasCurrent) return

      const fallback = organizations.value[0]?.id ?? ''
      if (fallback) {
        await switchOrganization(fallback)
        return
      }
      // 没有其它组织了：清空当前工作区
      workspaceRevision.value++
      invalidateWorkspace()
      permissions.reset()
      currentOrganizationId.value = ''
      currentProjectId.value = ''
      projects.value = []
      subscription.value = null
      workspaceState.value = 'ready'
      workspaceError.value = ''
    }

    /** Commit an authorized deep-link lookup without reviving older workspace requests. */
    function applyWorkspace(
      orgId: string,
      projectId: string,
      orgs: Organization[],
      items: Project[],
      revision: number,
    ) {
      if (revision !== workspaceRevision.value) return false
      workspaceRevision.value++
      invalidateWorkspace()
      organizations.value = orgs
      currentOrganizationId.value = orgId
      projects.value = items
      currentProjectId.value = projectId
      subscription.value = null
      subscriptionRequest++
      return true
    }

    /** 退出登录等场景清空工作区 */
    function reset() {
      workspaceRevision.value++
      organizationsRequest++
      projectsRequest++
      subscriptionRequest++
      organizations.value = []
      currentOrganizationId.value = ''
      projects.value = []
      currentProjectId.value = ''
      subscription.value = null
      workspaceState.value = 'idle'
      workspaceError.value = ''
    }
    async function loadWorkspace(force = false) {
      const revision = workspaceRevision.value
      workspaceState.value = 'loading'
      workspaceError.value = ''
      try {
        if (!organizations.value.length) await loadOrganizations()
        if (revision !== workspaceRevision.value) return
        if (force) await permissions.ensureOrganization(currentOrganizationId.value, true)
        await loadProjects()
        if (revision !== workspaceRevision.value) return
        const entry = permissions.organizations[currentOrganizationId.value]
        if (currentOrganizationId.value && entry?.state !== 'ready')
          throw new Error(entry?.error || 'Workspace unavailable')
        workspaceState.value = 'ready'
        void loadSubscription().catch(() => undefined)
      } catch (error) {
        if (revision !== workspaceRevision.value) return
        projects.value = []
        subscription.value = null
        workspaceState.value = 'error'
        workspaceError.value = error instanceof Error ? error.message : ''
      }
    }
    watch(sessionEpoch, reset, { flush: 'sync' })
    let observedWorkspace = workspaceEpoch.value
    watch(
      permissionEpoch,
      () => {
        if (observedWorkspace !== workspaceEpoch.value) {
          observedWorkspace = workspaceEpoch.value
          return
        }
        organizationsRequest++
        projectsRequest++
        subscriptionRequest++
        organizations.value = []
        projects.value = []
        subscription.value = null
        workspaceState.value = 'idle'
        workspaceError.value = ''
      },
      { flush: 'sync' },
    )

    return {
      organizations,
      currentOrganizationId,
      projects,
      currentProjectId,
      subscription,
      workspaceRevision,
      workspaceState,
      workspaceError,
      currentOrganization,
      currentProject,
      currentPlan,
      currentPlanExpiresAt,
      loadOrganizations,
      loadWorkspace,
      loadProjects,
      loadSubscription,
      switchOrganization,
      switchProject,
      createProject,
      leaveOrganization,
      applyWorkspace,
      reset,
    }
  },
  {
    persist: {
      key: 'beacon-vue3:organization',
      pick: ['currentOrganizationId', 'currentProjectId'],
    },
  },
)
