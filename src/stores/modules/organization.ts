import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getSubscriptionStack, listOrganizations, listProjects } from '@/api'
import type { Organization, Project } from '@/api/types'
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
    let organizationsRequest = 0
    let projectsRequest = 0
    let subscriptionRequest = 0

    const currentOrganization = computed(
      () => organizations.value.find((item) => item.id === currentOrganizationId.value) ?? null,
    )

    const currentProject = computed(
      () => projects.value.find((item) => item.id === currentProjectId.value) ?? null,
    )

    /** 当前生效套餐，无生效订阅时为 null（等同免费版） */
    const currentPlan = computed<Plan | null>(() => subscription.value?.effectivePlan ?? null)

    /** 生效订阅的到期时间：取订阅栈里 isEffective 的那条 */
    const currentPlanExpiresAt = computed(
      () => subscription.value?.stack.find((entry) => entry.isEffective)?.expiresAt ?? null,
    )

    /** 拉取当前团队的订阅栈；切换团队与套餐升级成功后调用 */
    async function loadSubscription(orgId = currentOrganizationId.value) {
      const request = ++subscriptionRequest
      if (!orgId) {
        subscription.value = null
        return null
      }

      const result = await getSubscriptionStack(orgId)
      if (request !== subscriptionRequest || orgId !== currentOrganizationId.value)
        return subscription.value
      subscription.value = result
      return subscription.value
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

      await loadSubscription()
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

      return projects.value
    }

    /** 切换团队，并重新加载该团队的项目与套餐 */
    async function switchOrganization(id: string) {
      if (id === currentOrganizationId.value) return
      workspaceRevision.value++
      currentOrganizationId.value = id
      currentProjectId.value = ''
      projects.value = []
      subscription.value = null
      await Promise.all([loadProjects(id), loadSubscription(id)])
    }

    function switchProject(id: string) {
      if (id === currentProjectId.value) return
      workspaceRevision.value++
      currentProjectId.value = id
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
    }

    return {
      organizations,
      currentOrganizationId,
      projects,
      currentProjectId,
      subscription,
      workspaceRevision,
      currentOrganization,
      currentProject,
      currentPlan,
      currentPlanExpiresAt,
      loadOrganizations,
      loadProjects,
      loadSubscription,
      switchOrganization,
      switchProject,
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
