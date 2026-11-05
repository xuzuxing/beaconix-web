import type { RumAlertChannel } from '@/api/types/rum'
import type { AxiosRequestConfig } from 'axios'
import type {
  RumErrorUpdateInput,
  RumErrorNote,
  RumErrorStatusFilter,
  RumMaintenanceJob,
  RumPerformancePage,
  RumPerformanceResource,
  RumPerformanceResponse,
  RumPerformanceSummary,
  RumReleaseCompare,
  RumReleaseSummary,
  RumProjectOverview,
  RumProjectError,
  RumProjectEvent,
  RumApp,
  RumAppInput,
  RumPage,
  RumErrorGroup,
  RumErrorOccurrence,
  RumEvent,
  RumEventStats,
  RumReplaySession,
  RumReplayChunks,
  RumSourceMap,
  RumAlertRule,
  RumAlertInput,
  RumAlertIncident,
} from '@/api/types/rum'
import { del, get, patch, post, upload } from '@/utils/request'

const appsPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/apps`
const appPath = (projectId: string, appId: string) =>
  `${appsPath(projectId)}/${encodeURIComponent(appId)}`

export function listRumApps(projectId: string, config?: AxiosRequestConfig) {
  return get<RumApp[]>(appsPath(projectId), undefined, config)
}
export function getRumApp(projectId: string, appId: string, config?: AxiosRequestConfig) {
  return get<RumApp>(appPath(projectId, appId), undefined, config)
}
export function createRumApp(projectId: string, data: RumAppInput) {
  return post<RumApp>(appsPath(projectId), data)
}
export function updateRumApp(projectId: string, appId: string, data: Partial<RumAppInput>) {
  return patch<RumApp>(appPath(projectId, appId), data)
}
export function setRumAppEnabled(projectId: string, appId: string, enabled: boolean) {
  return post<RumApp>(`${appPath(projectId, appId)}/${enabled ? 'enable' : 'disable'}`)
}

type Query = Record<string, string | number | undefined>
const projectRum = (projectId: string, suffix: string) =>
  `/projects/${encodeURIComponent(projectId)}/rum/${suffix}`
export const getProjectRumOverview = (p: string, config?: AxiosRequestConfig) =>
  get<RumProjectOverview>(projectRum(p, 'overview'), undefined, config)
export const listProjectRumErrors = (p: string, params: Query = {}, config?: AxiosRequestConfig) =>
  get<RumPage<RumProjectError>>(projectRum(p, 'errors'), params, config)
export const listProjectRumEvents = (p: string, params: Query = {}, config?: AxiosRequestConfig) =>
  get<RumPage<RumProjectEvent>>(projectRum(p, 'events'), params, config)
const nested = (projectId: string, appId: string, suffix: string) =>
  `${appPath(projectId, appId)}/${suffix}`
const enc = encodeURIComponent
export const listRumErrors = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPage<RumErrorGroup>>(nested(p, a, 'errors'), params, config)
export const getRumError = (p: string, a: string, id: string, config?: AxiosRequestConfig) =>
  get<RumErrorGroup>(nested(p, a, `errors/${enc(id)}`), undefined, config)
export const listRumErrorOccurrences = (
  p: string,
  a: string,
  id: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPage<RumErrorOccurrence>>(nested(p, a, `errors/${enc(id)}/occurrences`), params, config)
export const listRumEvents = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPage<RumEvent>>(nested(p, a, 'events'), params, config)
export const getRumEventStats = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumEventStats>(nested(p, a, 'events/stats'), params, config)
export const listRumReplays = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPage<RumReplaySession>>(nested(p, a, 'replays'), params, config)
export const getRumReplay = (p: string, a: string, id: string, config?: AxiosRequestConfig) =>
  get<RumReplaySession>(nested(p, a, `replays/${enc(id)}`), undefined, config)
export const listRumReplayChunks = (
  p: string,
  a: string,
  id: string,
  afterSequence: number,
  config?: AxiosRequestConfig,
) =>
  get<RumReplayChunks>(
    nested(p, a, `replays/${enc(id)}/chunks`),
    { afterSequence, limit: 50 },
    config,
  )
export const listRumSourceMaps = (p: string, a: string, config?: AxiosRequestConfig) =>
  get<RumSourceMap[]>(nested(p, a, 'source-maps'), undefined, config)
export const uploadRumSourceMap = (
  p: string,
  a: string,
  data: FormData,
  config?: AxiosRequestConfig,
) => upload<RumSourceMap & { reprocessed: number }>(nested(p, a, 'source-maps'), data, config)
export const deleteRumSourceMap = (p: string, a: string, id: string) =>
  del<void>(nested(p, a, `source-maps/${enc(id)}`))
export const listRumAlertChannels = (p: string, a: string, config?: AxiosRequestConfig) =>
  get<RumAlertChannel[]>(nested(p, a, 'alerts/channels'), undefined, config)
export const listRumAlertRules = (p: string, a: string, config?: AxiosRequestConfig) =>
  get<RumAlertRule[]>(nested(p, a, 'alerts'), undefined, config)
export const createRumAlertRule = (p: string, a: string, data: RumAlertInput) =>
  post<RumAlertRule>(nested(p, a, 'alerts'), data)
export const updateRumAlertRule = (
  p: string,
  a: string,
  id: string,
  data: Partial<RumAlertInput>,
) => patch<RumAlertRule>(nested(p, a, `alerts/${enc(id)}`), data)
export const deleteRumAlertRule = (p: string, a: string, id: string) =>
  del<void>(nested(p, a, `alerts/${enc(id)}`))
export const updateRumError = (p: string, a: string, id: string, data: RumErrorUpdateInput) =>
  patch<RumErrorGroup>(nested(p, a, `errors/${enc(id)}`), data)
export const listRumErrorNotes = (
  p: string,
  a: string,
  id: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPage<RumErrorNote>>(nested(p, a, `errors/${enc(id)}/notes`), params, config)
export const createRumErrorNote = (p: string, a: string, id: string, body: string) =>
  post<RumErrorNote>(nested(p, a, `errors/${enc(id)}/notes`), { body })
export const deleteRumErrorNote = (p: string, a: string, id: string, noteId: string) =>
  del<void>(nested(p, a, `errors/${enc(id)}/notes/${enc(noteId)}`))

export type RumErrorQuery = Query & { status?: RumErrorStatusFilter }
export const listRumReleases = (p: string, a: string, config?: AxiosRequestConfig) =>
  get<{ items: RumReleaseSummary[]; total: number }>(nested(p, a, 'releases'), undefined, config)
export const compareRumReleases = (
  p: string,
  a: string,
  base: string,
  target: string,
  config?: AxiosRequestConfig,
) => get<RumReleaseCompare>(nested(p, a, 'releases/compare'), { base, target }, config)

export const rotateRumAppKey = (p: string, a: string) => post<RumApp>(`${appPath(p, a)}/rotate-key`)
export const purgeRumApp = (p: string, a: string) => post<RumMaintenanceJob>(nested(p, a, 'purge'))
export const deleteRumSubject = (
  p: string,
  a: string,
  data: { endUserId?: string; anonymousId?: string },
) => post<RumMaintenanceJob>(nested(p, a, 'subjects/deletion'), data)
export const getRumMaintenanceJob = (
  p: string,
  a: string,
  jobId: string,
  config?: AxiosRequestConfig,
) => get<RumMaintenanceJob>(nested(p, a, `maintenance-jobs/${enc(jobId)}`), undefined, config)

export const getRumPerformance = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPerformanceResponse>(nested(p, a, 'performance'), params, config)
export const getRumPerformanceSummary = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPerformanceSummary>(nested(p, a, 'performance/summary'), params, config)
export const getRumPerformancePages = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<{ items: RumPerformancePage[] }>(nested(p, a, 'performance/pages'), params, config)
export const getRumPerformanceResources = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<{ items: RumPerformanceResource[] }>(nested(p, a, 'performance/resources'), params, config)

export const listRumAlertIncidents = (
  p: string,
  a: string,
  params: Query = {},
  config?: AxiosRequestConfig,
) => get<RumPage<RumAlertIncident>>(nested(p, a, 'alerts/incidents'), params, config)
