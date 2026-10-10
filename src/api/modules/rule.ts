import type {
  BindRuleParams,
  CreateRuleGroupParams,
  MonitorRuleBinding,
  RuleGroup,
  RuleMeta,
  UpdateRuleGroupParams,
} from '../types/rule'
import { get, patch, post, request } from '@/utils/request'
import type { AxiosRequestConfig } from 'axios'

/** 规则字段 / 操作符元数据：前端编辑器的唯一事实源（无需鉴权） */
export function getRuleMeta(config?: AxiosRequestConfig) {
  return get<RuleMeta>('/rule-meta', undefined, config)
}

/** 组织下的规则组（含项目级规则组） */
export function listRuleGroups(orgId: string, config?: AxiosRequestConfig) {
  return get<RuleGroup[]>(`/organizations/${encodeURIComponent(orgId)}/rule-groups`, undefined, config)
}

export function getRuleGroup(orgId: string, id: string, config?: AxiosRequestConfig) {
  return get<RuleGroup>(
    `/organizations/${encodeURIComponent(orgId)}/rule-groups/${encodeURIComponent(id)}`,
    undefined,
    config,
  )
}

export function createRuleGroup(orgId: string, data: CreateRuleGroupParams) {
  return post<RuleGroup>(`/organizations/${encodeURIComponent(orgId)}/rule-groups`, data)
}

export function updateRuleGroup(orgId: string, id: string, data: UpdateRuleGroupParams) {
  return patch<RuleGroup>(
    `/organizations/${encodeURIComponent(orgId)}/rule-groups/${encodeURIComponent(id)}`,
    data,
  )
}

/** 监控项已绑定的规则组（含规则组本体，按优先级降序） */
export function listMonitorRuleBindings(
  projectId: string,
  monitorId: string,
  config?: AxiosRequestConfig,
) {
  return get<MonitorRuleBinding[]>(
    `/projects/${encodeURIComponent(projectId)}/monitors/${encodeURIComponent(monitorId)}/rule-bindings`,
    undefined,
    config,
  )
}

/** 把规则组绑定到监控项（重复绑定等价于更新优先级） */
export function bindRuleGroup(projectId: string, monitorId: string, data: BindRuleParams) {
  return post<MonitorRuleBinding>(
    `/projects/${encodeURIComponent(projectId)}/monitors/${encodeURIComponent(monitorId)}/rule-bindings`,
    data,
  )
}

/** 解除监控项与规则组的绑定 */
export function unbindRuleGroup(projectId: string, monitorId: string, ruleGroupId: string) {
  return request<void>({
    url: `/projects/${encodeURIComponent(projectId)}/monitors/${encodeURIComponent(monitorId)}/rule-bindings/${encodeURIComponent(ruleGroupId)}`,
    method: 'delete',
  })
}
