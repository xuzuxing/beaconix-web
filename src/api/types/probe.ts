import type { MonitorType, PageQuery } from '../types'
import type { ProbeProvider, ProbeValidationChallenge, SystemProbe } from './admin'

export type { ProbeProvider, ProbeValidationChallenge }

export interface TenantProbe extends Omit<SystemProbe, 'scope' | 'monitors'> {
  scope: 'TENANT'
  organizationId: string
  monitors: ProbeMonitor[]
}

export interface ProbeMonitor {
  id: string
  name: string
  type: MonitorType
  target: string
  enabled: boolean
}

export interface CreateProbeParams {
  name: string
  provider: ProbeProvider
  region: string
  callbackUrl: string
  enabled?: boolean
}
export type UpdateProbeParams = Partial<CreateProbeParams>
export interface ProbeEnrollmentParams {
  name?: string
  provider?: ProbeProvider
  region?: string
}
export interface ProbeEnrollment {
  token: string
  expiresAt: string
  command: string
  apiUrl: string
}
export interface ProbeActivation {
  userCode: string
  status: 'pending' | 'approved' | 'denied'
  requestedAt: string
  client: {
    client?: string
    hostname?: string
    platform?: string
    runtime?: string
  }
}
export type ProbeActivationScope = 'TENANT' | 'SYSTEM'

export interface ApproveProbeActivationParams extends ProbeEnrollmentParams {
  userCode: string
  /** SYSTEM requires SUPER_ADMIN; TENANT (default) requires organizationId. */
  scope?: ProbeActivationScope
  organizationId?: string
}
export interface ProbeActivationApproval {
  probeId: string
  organizationId: string | null
  scope: ProbeActivationScope
  status: 'approved'
}
export type ProbeExecutionTrigger = 'SCHEDULED' | 'MANUAL' | 'CALLBACK'
export type ProbeExecutionStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'SKIPPED'
export interface ProbeResult {
  id: string
  probeId: string
  target: string
  success: boolean
  error: string | null
  latency: number
  checkedAt: string
}
export interface ProbeExecution {
  id: string
  probeId: string | null
  monitorId: string | null
  target: string
  trigger: ProbeExecutionTrigger
  status: ProbeExecutionStatus
  success: boolean
  latency: number | null
  error: string | null
  requestMeta: unknown
  responseMeta: unknown
  executedAt: string
}
export interface ProbeResultQuery extends PageQuery {
  target?: string
}
export interface ProbeExecutionQuery extends ProbeResultQuery {
  trigger?: ProbeExecutionTrigger
  status?: ProbeExecutionStatus
  monitorId?: string
}
