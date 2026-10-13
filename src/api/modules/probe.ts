import type { AxiosRequestConfig } from 'axios'
import type { Paginated } from '../types'
import type {
  CreateProbeParams,
  UpdateProbeParams,
  TenantProbe,
  ProbeEnrollment,
  ProbeEnrollmentParams,
  ProbeExecution,
  ProbeExecutionQuery,
  ProbeResult,
  ProbeResultQuery,
  ProbeValidationChallenge,
} from '../types/probe'
import { del, get, patch, post } from '@/utils/request'

const base = (orgId: string) => `/organizations/${encodeURIComponent(orgId)}/probes`
const resource = (orgId: string, id: string) => `${base(orgId)}/${encodeURIComponent(id)}`

export const listProbes = (orgId: string, config?: AxiosRequestConfig) =>
  get<TenantProbe[]>(base(orgId), undefined, config)
export const getProbe = (orgId: string, id: string, config?: AxiosRequestConfig) =>
  get<TenantProbe>(resource(orgId, id), undefined, config)
export const createProbe = (orgId: string, data: CreateProbeParams) =>
  post<TenantProbe>(base(orgId), data)
export const updateProbe = (orgId: string, id: string, data: UpdateProbeParams) =>
  patch<TenantProbe>(resource(orgId, id), data)
export const deleteProbe = (orgId: string, id: string) =>
  del<{ id: string; deleted: boolean }>(resource(orgId, id))
export const rotateProbeSecret = (orgId: string, id: string) =>
  post<TenantProbe>(`${resource(orgId, id)}/rotate-secret`)
export const validateProbe = (orgId: string, id: string) =>
  post<ProbeValidationChallenge>(`${resource(orgId, id)}/validate`)
export const createProbeEnrollment = (orgId: string, data: ProbeEnrollmentParams) =>
  post<ProbeEnrollment>(`${base(orgId)}/enroll-token`, data)
export const bindProbeMonitors = (orgId: string, id: string, monitorIds: string[]) =>
  post<TenantProbe>(`${resource(orgId, id)}/monitors`, { monitorIds })
export const unbindProbeMonitor = (orgId: string, id: string, monitorId: string) =>
  del<TenantProbe>(`${resource(orgId, id)}/monitors/${encodeURIComponent(monitorId)}`)
export const listProbeResults = (
  orgId: string,
  id: string,
  params: ProbeResultQuery,
  config?: AxiosRequestConfig,
) => get<Paginated<ProbeResult>>(`${resource(orgId, id)}/results`, { ...params }, config)
export const listProbeExecutions = (
  orgId: string,
  id: string,
  params: ProbeExecutionQuery,
  config?: AxiosRequestConfig,
) => get<Paginated<ProbeExecution>>(`${resource(orgId, id)}/executions`, { ...params }, config)
