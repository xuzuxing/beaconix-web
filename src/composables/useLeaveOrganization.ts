import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'

import type { Organization } from '@/api/types'
import { useOrganizationStore } from '@/stores'

/**
 * 退出组织（加入的组织）：二次确认后调用 store，成功后提示并回调。
 * 请求失败时请求层已统一 toast，这里只恢复确认按钮的 loading 供用户重试。
 */
export function useLeaveOrganization() {
  const { t } = useI18n()
  const orgStore = useOrganizationStore()

  /**
   * 弹窗确认退出指定组织。
   * @param onLeft 成功后回调，参数表示退出的是否为当前组织（用于刷新页面 / 路由收尾）。
   */
  async function confirmLeave(org: Organization, onLeft?: (wasCurrent: boolean) => void) {
    const wasCurrent = org.id === orgStore.currentOrganizationId
    let submitting = false

    const dialog = DialogPlugin.confirm({
      header: t('workspace.team.leaveTitle'),
      body: t('workspace.team.leaveConfirm', { name: org.name }),
      theme: 'warning',
      confirmBtn: { content: t('workspace.team.leave'), theme: 'danger' },
      cancelBtn: t('common.cancel'),
      onConfirm: async () => {
        if (submitting) return
        submitting = true
        dialog.setConfirmLoading(true)
        try {
          await orgStore.leaveOrganization(org.id)
          MessagePlugin.success(t('workspace.team.leaveDone'))
          dialog.destroy()
          onLeft?.(wasCurrent)
        } catch {
          // 请求层已统一提示错误；恢复确认按钮供用户重试
          submitting = false
          dialog.setConfirmLoading(false)
        }
      },
    })
  }

  return { confirmLeave }
}
