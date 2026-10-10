import type { CreateProjectParams, Project, UpdateProjectParams } from '../types'
import { del, get, patch, post } from '@/utils/request'

/** 组织内的项目列表 */
export function listProjects(orgId: string) {
  return get<Project[]>(`/organizations/${orgId}/projects`)
}

/** 新建项目（ADMIN+） */
export function createProject(orgId: string, data: CreateProjectParams) {
  return post<Project>(`/organizations/${orgId}/projects`, data)
}

/** 项目详情 */
export function getProject(orgId: string, id: string) {
  return get<Project>(`/organizations/${orgId}/projects/${id}`)
}

/** 更新项目（ADMIN+） */
export function updateProject(orgId: string, id: string, data: UpdateProjectParams) {
  return patch<Project>(`/organizations/${orgId}/projects/${id}`, data)
}

/** 软删除项目（ADMIN+） */
export function deleteProject(orgId: string, id: string) {
  return del<Project>(`/organizations/${orgId}/projects/${id}`)
}

/** 归档项目，归档后只读（ADMIN+） */
export function archiveProject(orgId: string, id: string) {
  return post<Project>(`/organizations/${orgId}/projects/${id}/archive`)
}

/** 恢复软删除的项目（ADMIN+） */
export function restoreProject(orgId: string, id: string) {
  return post<Project>(`/organizations/${orgId}/projects/${id}/restore`)
}
