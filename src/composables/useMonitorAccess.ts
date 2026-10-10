import { useOrganizationRole } from './useOrganizationRole'

/**
 * 监控模块的角色权限。
 * 监控项与通知渠道的管理规则一致，统一由组织角色派生（见 useOrganizationRole）。
 */
export function useMonitorAccess() {
  const { canManage, canCheck } = useOrganizationRole()
  return { canManage, canCheck }
}
