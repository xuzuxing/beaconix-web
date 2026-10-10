import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { listOrganizations, listProjects } from '@/api'
import type { Organization, Project } from '@/api/types'

/**
 * 工作区状态：当前团队（组织）与当前项目。
 * - 团队列表来自 GET /organizations
 * - 项目列表来自 GET /organizations/{orgId}/projects
 * 只持久化两个 id，列表在需要时重新拉取，避免缓存过期数据。
 */
export const useOrganizationStore = defineStore(
  'organization',
  () => {
    const organizations = ref<Organization[]>([])
    const currentOrganizationId = ref('')
    const projects = ref<Project[]>([])
    const currentProjectId = ref('')

    const currentOrganization = computed(
      () => organizations.value.find((item) => item.id === currentOrganizationId.value) ?? null,
    )

    const currentProject = computed(
      () => projects.value.find((item) => item.id === currentProjectId.value) ?? null,
    )

    /** 拉取当前用户的团队列表；若已选团队不在列表中则回落到第一个 */
    async function loadOrganizations() {
      organizations.value = await listOrganizations()

      const exists = organizations.value.some((item) => item.id === currentOrganizationId.value)
      if (!exists) {
        currentOrganizationId.value = organizations.value[0]?.id ?? ''
      }

      return organizations.value
    }

    /** 拉取指定团队的项目列表；若已选项目不在列表中则回落到第一个 */
    async function loadProjects(orgId = currentOrganizationId.value) {
      if (!orgId) {
        projects.value = []
        currentProjectId.value = ''
        return projects.value
      }

      projects.value = await listProjects(orgId)

      const exists = projects.value.some((item) => item.id === currentProjectId.value)
      if (!exists) {
        currentProjectId.value = projects.value[0]?.id ?? ''
      }

      return projects.value
    }

    /** 切换团队，并重新加载该团队的项目 */
    async function switchOrganization(id: string) {
      if (id === currentOrganizationId.value) return
      currentOrganizationId.value = id
      currentProjectId.value = ''
      projects.value = []
      await loadProjects(id)
    }

    function switchProject(id: string) {
      currentProjectId.value = id
    }

    /** 退出登录等场景清空工作区 */
    function reset() {
      organizations.value = []
      currentOrganizationId.value = ''
      projects.value = []
      currentProjectId.value = ''
    }

    return {
      organizations,
      currentOrganizationId,
      projects,
      currentProjectId,
      currentOrganization,
      currentProject,
      loadOrganizations,
      loadProjects,
      switchOrganization,
      switchProject,
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
