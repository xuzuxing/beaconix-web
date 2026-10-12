import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { listMonitors, listProjects } from '@/api'
import type { MonitorStatus, MonitorType } from '@/api/types'

/** 状态页编辑器里的可选监控项：带上所属项目，便于分组展示 */
export interface OrganizationMonitorOption {
  id: string
  name: string
  type: MonitorType
  target: string
  status: MonitorStatus
  projectId: string
  projectName: string
}

/**
 * 组织内全部监控项（跨项目汇总）。
 *
 * 状态页的 `visibleMonitorIds` 必须属于该组织，但监控列表接口只有项目维度
 * （`GET /projects/{projectId}/monitors`），因此先取组织下的项目再逐个项目拉取。
 * 单个项目读取失败不影响其它项目（allSettled），配额或权限受限的项目至多少几个可选项。
 */
export function useOrganizationMonitors(orgId: MaybeRefOrGetter<string | undefined>) {
  const { t } = useI18n()
  const monitors = ref<OrganizationMonitorOption[]>([])
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined

  async function load() {
    const token = ++generation
    const organization = toValue(orgId)
    controller?.abort()
    // 闭包（projects.map）里访问会失去 let 变量的类型收窄，这里留一份 const 引用
    const active = new AbortController()
    controller = active
    error.value = ''
    if (!organization) {
      monitors.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const projects = await listProjects(organization)
      if (token !== generation) return
      const results = await Promise.allSettled(
        projects.map((project) => listMonitors(project.id, { signal: active.signal })),
      )
      if (token !== generation) return
      const options: OrganizationMonitorOption[] = []
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return
        const project = projects[index]
        if (!project) return
        result.value.forEach((monitor) =>
          options.push({
            id: monitor.id,
            name: monitor.name,
            type: monitor.type,
            target: monitor.target,
            status: monitor.status,
            projectId: project.id,
            projectName: project.name,
          }),
        )
      })
      options.sort(
        (a, b) => a.projectName.localeCompare(b.projectName) || a.name.localeCompare(b.name),
      )
      monitors.value = options
    } catch (cause) {
      if (token === generation)
        error.value = cause instanceof Error ? cause.message : t('statusPage.monitorsLoadFailed')
    } finally {
      if (token === generation) loading.value = false
    }
  }

  watch(
    () => toValue(orgId),
    () => {
      monitors.value = []
      void load()
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })

  return { monitors, loading, error, load }
}
