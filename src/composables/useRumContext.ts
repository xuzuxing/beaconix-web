import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { accessContext, isCurrentContext } from '@/utils/access-context'

export function useRumContext() {
  const route = useRoute()
  const router = useRouter()
  const org = useOrganizationStore()
  const permissions = usePermissionsStore()
  const projectId = computed(() =>
    typeof route.params.projectId === 'string' ? route.params.projectId : '',
  )
  const appId = computed(() => (typeof route.params.appId === 'string' ? route.params.appId : ''))
  watch(
    projectId,
    (id) => {
      if (id && id !== org.currentProjectId && org.projects.some((project) => project.id === id))
        void org.switchProject(id)
    },
    { immediate: true, flush: 'sync' },
  )
  const canReadRum = computed(() => permissions.canProject(projectId.value, 'rum.read'))
  const canManage = computed(
    () =>
      org.currentProject?.status === 'ACTIVE' &&
      permissions.canProject(projectId.value, 'app.manage'),
  )
  watch(
    () => org.currentProjectId,
    (id, oldId) => {
      if (oldId && id !== oldId && id !== projectId.value) void router.replace('/rum')
    },
    { flush: 'sync' },
  )
  async function authorizeWrite() {
    const id = projectId.value
    const context = accessContext()
    const result = await permissions.ensureProject(id, true)
    return (
      isCurrentContext(context) &&
      id === org.currentProjectId &&
      org.currentProject?.status === 'ACTIVE' &&
      result?.capabilities['app.manage'] === true
    )
  }
  return { route, router, org, projectId, appId, canReadRum, canManage, authorizeWrite }
}
