import { computed, ref } from 'vue'

import {
  createSystemProbe,
  deleteSystemProbe,
  listSystemProbes,
  rebalanceSystemProbes,
  toggleSystemProbe,
  updateSystemProbe,
  validateSystemProbe,
} from '@/api'
import type {
  CreateSystemProbeParams,
  ProbeValidationChallenge,
  SystemProbe,
  SystemProbeAssignments,
  UpdateSystemProbeParams,
} from '@/api/types/admin'
import { probeLiveness, probeMatches, type ProbeLiveness } from '@/utils/admin-presenter'

/** 存活状态筛选值 */
export type ProbeLivenessFilter = ProbeLiveness | 'all'

/**
 * 系统探针列表与操作（仅 SUPER_ADMIN）。
 * 列表不分页，筛选在前端完成；存活状态用一次快照时间判断，避免逐行取当前时间导致抖动。
 */
export function useAdminProbes() {
  const probes = ref<SystemProbe[]>([])
  const loading = ref(false)
  const error = ref('')
  const keyword = ref('')
  const liveness = ref<ProbeLivenessFilter>('all')
  const busyId = ref('')
  const now = ref(Date.now())
  let request = 0

  const filtered = computed(() =>
    probes.value
      .filter((probe) => probeMatches(probe, keyword.value))
      .filter((probe) => liveness.value === 'all' || probeLiveness(probe, now.value) === liveness.value),
  )

  /** 名称重复时用于在编辑弹窗里标出当前探针 */
  function livenessOf(probe: SystemProbe): ProbeLiveness {
    return probeLiveness(probe, now.value)
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listSystemProbes()
      if (token !== request) return
      probes.value = result ?? []
      now.value = Date.now()
    } catch (cause) {
      if (token !== request) return
      probes.value = []
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  async function create(data: CreateSystemProbeParams): Promise<SystemProbe> {
    const created = await createSystemProbe(data)
    await load()
    return created
  }

  async function update(id: string, data: UpdateSystemProbeParams): Promise<SystemProbe> {
    busyId.value = id
    try {
      const updated = await updateSystemProbe(id, data)
      await load()
      return updated
    } finally {
      busyId.value = ''
    }
  }

  async function remove(id: string): Promise<void> {
    busyId.value = id
    try {
      await deleteSystemProbe(id)
      await load()
    } finally {
      busyId.value = ''
    }
  }

  async function toggle(probe: SystemProbe, enabled: boolean): Promise<SystemProbe> {
    busyId.value = probe.id
    try {
      const updated = await toggleSystemProbe(probe.id, enabled)
      const index = probes.value.findIndex((item) => item.id === probe.id)
      if (index >= 0) probes.value.splice(index, 1, updated)
      return updated
    } finally {
      busyId.value = ''
    }
  }

  async function validate(id: string): Promise<ProbeValidationChallenge> {
    busyId.value = id
    try {
      return await validateSystemProbe(id)
    } finally {
      busyId.value = ''
    }
  }

  async function rebalance(): Promise<SystemProbeAssignments> {
    loading.value = true
    try {
      const assignments = await rebalanceSystemProbes()
      await load()
      return assignments ?? {}
    } finally {
      loading.value = false
    }
  }

  return {
    probes,
    filtered,
    loading,
    error,
    keyword,
    liveness,
    busyId,
    load,
    livenessOf,
    create,
    update,
    remove,
    toggle,
    validate,
    rebalance,
  }
}
