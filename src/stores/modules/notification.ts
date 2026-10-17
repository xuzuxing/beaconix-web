import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'

import {
  deleteUserNotification,
  getUserNotificationById,
  getUserNotificationUnreadCount,
  listUserNotifications,
  markAllUserNotificationsAsRead,
  markUserNotificationAsRead,
  listOrganizations,
  listProjects,
} from '@/api'
import {
  acceptInvitationById,
  declineInvitationById,
  getInvitationById,
  listPendingInvitations,
} from '@/api/modules/invitation'
import { consumeNotificationStream } from '@/api/modules/notification-center'
import type { InvitationAction, UserInvitation } from '@/api/types/invitation'
import type { NotificationReadFilter, UserNotification } from '@/api/types/notification-center'
import { useOrganizationStore } from './organization'
import { useUserStore } from './user'
import { usePermissionsStore } from './permissions'
import { permissionEpoch } from '@/utils/access-context'
import {
  canActOnInvitation,
  notificationInvitationId,
  notificationReadParam,
  notificationReceivedInvitationId,
  notificationScope,
} from '@/utils/notification-presenter'

/** 顶栏事项抽屉里最多展示的条数：这里只做「最近的几条」，完整列表在通知列表页 */
export const RECENT_NOTIFICATION_LIMIT = 8

/**
 * 站内通知的跨组件状态：顶栏角标（未读数）、事项抽屉（开关 / 筛选 / 最近列表）与
 * 各页面共用的已读、忽略动作。
 * 列表页与详情页自带分页数据，不放进这里，只在动作后调用 refreshUnreadCount 同步角标。
 */
export const useNotificationStore = defineStore('notification', () => {
  const user = useUserStore()
  const organization = useOrganizationStore()
  const permissions = usePermissionsStore()
  // ---------- 未读数 ----------
  const unreadCount = ref(0)
  const hasUnread = computed(() => unreadCount.value > 0)

  // ---------- 事项抽屉 ----------
  const drawerVisible = ref(false)
  const filter = ref<NotificationReadFilter>('all')
  const recent = ref<UserNotification[]>([])
  /** 当前筛选下的总数 */
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  /** 是否成功拉取过一次，用于区分「加载中」与「真的没有事项」 */
  const loaded = ref(false)
  /** 各筛选下已知的总数；未加载过的筛选不显示计数 */
  const filterTotals = ref<Partial<Record<NotificationReadFilter, number>>>({})

  /** 并发保护：切筛选 / 关抽屉时丢弃过期响应 */
  let generation = 0
  let unreadGeneration = 0
  let pendingGeneration = 0
  let sessionGeneration = 0
  const revision = ref(0)
  const invitations = ref<Record<string, UserInvitation>>({})
  const invitationPending = ref<Record<string, InvitationAction>>({})
  const invitationErrors = ref<Record<string, string>>({})
  const invitationBlocked = ref<Record<string, boolean>>({})
  const pendingInvitations = ref<UserInvitation[]>([])
  const pendingLoading = ref(false)
  const pendingError = ref(false)
  const invitationRequests = new Map<string, Promise<UserInvitation>>()
  const seen = new Set<string>()
  const knownRead = new Set<string>()
  const readTimes = new Map<string, string>()
  const removed = new Set<string>()
  let stream: AbortController | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let eventTimer: ReturnType<typeof setTimeout> | undefined

  /** 筛选器上的计数：全部 / 未读 / 已读，未知时为 undefined（界面不渲染括号） */
  const counts = computed<Record<NotificationReadFilter, number | undefined>>(() => {
    const all = filterTotals.value.all
    const unread = filterTotals.value.unread ?? unreadCount.value
    return {
      all,
      unread,
      read: filterTotals.value.read ?? (all == null ? undefined : Math.max(all - unread, 0)),
    }
  })

  function syncUnread(next: number) {
    unreadCount.value = Math.max(0, next)
    filterTotals.value = { ...filterTotals.value, unread: unreadCount.value }
  }

  function invalidateRecent() {
    generation++
    loading.value = false
    filterTotals.value = {}
  }

  /** Local successful mutations win over stale REST snapshots and SSE replays. */
  function reconcileNotification(item: UserNotification): UserNotification | null {
    if (removed.has(item.id)) return null
    if (user.user?.id && item.userId !== user.user.id) return null
    seen.add(item.id)
    if (item.isRead) {
      knownRead.add(item.id)
      if (item.readAt) readTimes.set(item.id, item.readAt)
    }
    return knownRead.has(item.id)
      ? { ...item, isRead: true, readAt: readTimes.get(item.id) ?? item.readAt }
      : item
  }

  function reconcileNotifications(
    items: UserNotification[],
    readFilter: NotificationReadFilter = 'all',
  ) {
    return items.flatMap((item) => {
      const reconciled = reconcileNotification(item)
      if (
        !reconciled ||
        (readFilter === 'unread' && reconciled.isRead) ||
        (readFilter === 'read' && !reconciled.isRead)
      )
        return []
      return [reconciled]
    })
  }

  async function loadNotification(id: string) {
    if (removed.has(id)) return null
    const session = sessionGeneration
    const item = await getUserNotificationById(id)
    if (session !== sessionGeneration) return null
    return reconcileNotification(item)
  }

  /** 拉取未读数（顶栏挂载、抽屉打开、动作完成后调用） */
  async function refreshUnreadCount() {
    const request = ++unreadGeneration
    try {
      const result = await getUserNotificationUnreadCount()
      if (request !== unreadGeneration) return
      syncUnread(result?.count ?? 0)
    } catch {
      if (request === unreadGeneration) syncUnread(0)
    }
  }

  /** 拉取当前筛选下的最近几条事项 */
  async function loadRecent() {
    const token = ++generation
    loading.value = true
    error.value = ''
    try {
      const isRead = notificationReadParam(filter.value)
      const result = await listUserNotifications({
        ...(isRead === undefined ? {} : { isRead }),
        page: 1,
        limit: RECENT_NOTIFICATION_LIMIT,
      })
      if (token !== generation) return
      const data = result?.items ?? []
      recent.value = reconcileNotifications(data, filter.value)
      total.value = Math.max(
        0,
        (result?.total ?? data.length) - (data.length - recent.value.length),
      )
      loaded.value = true
      filterTotals.value = { ...filterTotals.value, [filter.value]: total.value }
    } catch (cause) {
      if (token !== generation) return
      error.value = cause instanceof Error ? cause.message : ''
      recent.value = []
      total.value = 0
    } finally {
      if (token === generation) loading.value = false
    }
  }

  /** 未读数 + 最近列表一起刷新 */
  async function refresh() {
    await Promise.all([refreshUnreadCount(), loadRecent()])
  }

  function openDrawer() {
    filter.value = 'all'
    drawerVisible.value = true
    void refresh()
  }

  function closeDrawer() {
    drawerVisible.value = false
    // 关闭后到达的响应不再回写列表
    generation++
    loading.value = false
  }

  function toggleDrawer() {
    if (drawerVisible.value) closeDrawer()
    else openDrawer()
  }

  function setFilter(next: NotificationReadFilter) {
    if (filter.value === next) return
    filter.value = next
    void loadRecent()
  }

  /**
   * 标记单条已读（抽屉内、列表页、详情页共用）。
   * wasUnread 用于校正顶栏未读数：列表页/详情页的条目不在抽屉的 recent 里，
   * 由调用方把自己的条目状态传进来，避免未读数被重复扣减或漏扣。
   */
  async function markAsRead(id: string, wasUnread = true) {
    if (knownRead.has(id) || removed.has(id)) return
    const session = sessionGeneration
    const result = await markUserNotificationAsRead(id)
    if (session !== sessionGeneration || knownRead.has(id) || removed.has(id)) return
    invalidateRecent()
    knownRead.add(id)
    readTimes.set(id, result.readAt ?? new Date().toISOString())
    seen.add(id)
    unreadGeneration++
    const item = recent.value.find((entry) => entry.id === id)
    if (item) {
      if (!item.isRead) {
        item.isRead = true
        item.readAt = readTimes.get(id)!
        syncUnread(unreadCount.value - 1)
      }
      if (filter.value === 'unread') {
        recent.value = recent.value.filter((entry) => entry.id !== id)
        total.value = Math.max(0, total.value - 1)
      }
    } else if (wasUnread) {
      syncUnread(unreadCount.value - 1)
    }
    revision.value++
  }

  async function loadPendingInvitations() {
    const request = ++pendingGeneration
    const session = sessionGeneration
    pendingLoading.value = true
    pendingError.value = false
    try {
      const result = await listPendingInvitations()
      if (request !== pendingGeneration || session !== sessionGeneration) return
      pendingInvitations.value = result
      result.forEach((item) => {
        invitations.value[item.id] = item
      })
    } catch {
      if (request === pendingGeneration) pendingError.value = true
    } finally {
      if (request === pendingGeneration) pendingLoading.value = false
    }
  }

  async function loadInvitation(id: string) {
    const existing = invitationRequests.get(id)
    if (existing) return existing
    const session = sessionGeneration
    const request = getInvitationById(id)
      .then((item) => {
        if (session === sessionGeneration && invitationRequests.get(id) === request) {
          invitations.value[id] = item
          invitationBlocked.value[id] = false
        }
        return item
      })
      .finally(() => {
        if (invitationRequests.get(id) === request) invitationRequests.delete(id)
      })
    invitationRequests.set(id, request)
    return request
  }

  async function actOnInvitation(notification: UserNotification, action: InvitationAction) {
    const id = notificationInvitationId(notification)
    if (!id || invitationPending.value[id] || invitationBlocked.value[id]) return false
    if (!canActOnInvitation(notification, invitations.value[id])) return false
    const session = sessionGeneration
    pendingGeneration++
    invitationPending.value[id] = action
    invitationErrors.value[id] = ''
    let success = false
    try {
      const current = await loadInvitation(id)
      if (session !== sessionGeneration) return false
      if (!canActOnInvitation(notification, current)) {
        invitationErrors.value[id] = 'stale'
        return false
      }
      const updated = await (action === 'accept'
        ? acceptInvitationById(id)
        : declineInvitationById(id))
      if (session !== sessionGeneration) return false
      invitationRequests.delete(id)
      invitations.value[id] = updated
      pendingGeneration++
      pendingInvitations.value = pendingInvitations.value.filter((item) => item.id !== id)
      success = true
      if (action === 'accept') {
        try {
          await organization.loadOrganizations()
          if (session === sessionGeneration) await organization.loadWorkspace(true)
          window.dispatchEvent(new Event('beacon-permissions-changed'))
        } catch {
          invitationErrors.value[id] = 'refreshFailed'
        }
      }
    } catch {
      if (session !== sessionGeneration) return false
      invitationErrors.value[id] = 'actionFailed'
      // A failed mutation can mean another tab already accepted/revoked the invite.
      try {
        invitationRequests.delete(id)
        await loadInvitation(id)
      } catch {
        if (session === sessionGeneration) invitationBlocked.value[id] = true
      }
    } finally {
      if (session === sessionGeneration) {
        await Promise.all([refresh(), loadPendingInvitations()])
        if (session === sessionGeneration) {
          revision.value++
          delete invitationPending.value[id]
        }
      }
    }
    return success
  }

  /** Resolve workspace hints only against resources the server authorizes for this user. */
  async function prepareNotificationTarget(notification: UserNotification) {
    const { organizationId, projectId } = notificationScope(notification)
    if (!organizationId) return
    const revision = organization.workspaceRevision
    const session = sessionGeneration
    const orgs = await listOrganizations()
    if (!orgs.some((item) => item.id === organizationId)) throw new Error('Workspace unavailable')
    const projects = await listProjects(organizationId)
    const authority = await permissions.ensureOrganization(organizationId, true)
    if (!authority) throw new Error('Workspace unavailable')
    if (projectId) {
      const project = await permissions.ensureProject(projectId, true)
      if (!project || project.organizationId !== organizationId)
        throw new Error('Project unavailable')
    }
    if (session !== sessionGeneration) throw new Error('Workspace changed')
    const selected =
      projectId ??
      (organization.currentOrganizationId === organizationId &&
      projects.some((item) => item.id === organization.currentProjectId)
        ? organization.currentProjectId
        : '')
    if (projectId && !projects.some((item) => item.id === projectId))
      throw new Error('Project unavailable')
    if (
      !organization.applyWorkspace(
        organizationId,
        selected || projects[0]?.id || '',
        orgs,
        projects,
        revision,
      )
    )
      throw new Error('Workspace changed')
    void organization.loadSubscription().catch(() => {})
  }

  function receiveNotification(item: UserNotification) {
    if (user.user?.id && item.userId !== user.user.id) return
    const duplicate = seen.has(item.id)
    seen.add(item.id)
    // A replay must not undo a local read or reinsert an ignored notification.
    if (duplicate) {
      return
    }
    // SSE is an invalidation signal; only fresh authorized REST data supplies content.
    filterTotals.value = {}
    revision.value++
    const invitationId = notificationReceivedInvitationId(item)
    const session = sessionGeneration
    if (invitationId)
      void loadInvitation(invitationId).catch(() => {
        if (session === sessionGeneration) invitationBlocked.value[invitationId] = true
      })
    // Use the server's count, not a delta that would race a station read/reconnect.
    if (!eventTimer)
      eventTimer = setTimeout(() => {
        eventTimer = undefined
        void refresh()
        void loadPendingInvitations()
      }, 100)
  }

  function stopStream() {
    stream?.abort()
    stream = undefined
    clearTimeout(retryTimer)
    clearTimeout(eventTimer)
    retryTimer = undefined
    eventTimer = undefined
  }

  function startStream(token: string) {
    stopStream()
    if (!token) return
    const controller = new AbortController()
    stream = controller
    const session = sessionGeneration
    void consumeNotificationStream(token, controller.signal, (item) => {
      if (session === sessionGeneration && stream === controller && !controller.signal.aborted)
        receiveNotification(item)
    })
      .catch(() => {
        // REST requests below also run the existing access-token refresh flow.
      })
      .finally(() => {
        if (controller.signal.aborted || session !== sessionGeneration) return
        retryTimer = setTimeout(() => {
          window.dispatchEvent(new Event('beacon-permissions-revalidate'))
          void refresh()
          startStream(user.accessToken)
        }, 5000)
      })
    void refreshUnreadCount()
  }

  watch(
    () => user.user?.id,
    () => {
      sessionGeneration++
      generation++
      unreadGeneration++
      pendingGeneration++
      recent.value = []
      total.value = 0
      loaded.value = false
      loading.value = false
      error.value = ''
      filterTotals.value = {}
      syncUnread(0)
      invitations.value = {}
      invitationPending.value = {}
      invitationErrors.value = {}
      invitationBlocked.value = {}
      pendingInvitations.value = []
      pendingLoading.value = false
      pendingError.value = false
      invitationRequests.clear()
      seen.clear()
      knownRead.clear()
      readTimes.clear()
      removed.clear()
      drawerVisible.value = false
      stopStream()
      startStream(user.accessToken)
    },
    { flush: 'sync' },
  )
  watch(
    () => user.accessToken,
    (token) => {
      startStream(token)
      if (!token) {
        generation++
        unreadGeneration++
        pendingGeneration++
        syncUnread(0)
        recent.value = []
        seen.clear()
        knownRead.clear()
        readTimes.clear()
        removed.clear()
      }
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(stopStream)
  watch(
    permissionEpoch,
    () => {
      sessionGeneration++
      generation++
      unreadGeneration++
      pendingGeneration++
      stopStream()
      recent.value = []
      total.value = 0
      loaded.value = false
      loading.value = false
      filterTotals.value = {}
      syncUnread(0)
      seen.clear()
      invitations.value = {}
      invitationPending.value = {}
      invitationErrors.value = {}
      invitationBlocked.value = {}
      pendingInvitations.value = []
      invitationRequests.clear()
      revision.value++
      if (user.isLogin) {
        startStream(user.accessToken)
        void refresh()
        void loadPendingInvitations()
      }
    },
    { flush: 'sync' },
  )

  /** 全部标记已读 */
  async function markAllAsRead() {
    const session = sessionGeneration
    const ids = new Set([...seen, ...recent.value.map((item) => item.id)])
    await markAllUserNotificationsAsRead()
    if (session !== sessionGeneration) return
    invalidateRecent()
    unreadGeneration++
    const readAt = new Date().toISOString()
    ids.forEach((id) => {
      knownRead.add(id)
      if (!readTimes.has(id)) readTimes.set(id, readAt)
    })
    recent.value = reconcileNotifications(recent.value, filter.value)
    syncUnread(0)
    revision.value++
    await loadRecent()
  }

  /** 忽略（删除）单条；wasUnread 语义同 markAsRead */
  async function remove(id: string, wasUnread = true) {
    if (removed.has(id)) return
    const session = sessionGeneration
    await deleteUserNotification(id)
    if (session !== sessionGeneration || removed.has(id)) return
    invalidateRecent()
    removed.add(id)
    unreadGeneration++
    seen.add(id)
    const item = recent.value.find((entry) => entry.id === id)
    recent.value = recent.value.filter((entry) => entry.id !== id)
    if (item) {
      total.value = Math.max(0, total.value - 1)
      filterTotals.value = { ...filterTotals.value, [filter.value]: total.value }
      if (!item.isRead) syncUnread(unreadCount.value - 1)
    } else if (wasUnread && !knownRead.has(id)) {
      syncUnread(unreadCount.value - 1)
    }
    revision.value++
  }

  return {
    unreadCount,
    hasUnread,
    drawerVisible,
    filter,
    recent,
    total,
    loading,
    error,
    loaded,
    counts,
    refreshUnreadCount,
    loadRecent,
    refresh,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    setFilter,
    markAsRead,
    markAllAsRead,
    remove,
    reconcileNotification,
    reconcileNotifications,
    loadNotification,
    revision,
    invitations,
    invitationPending,
    invitationErrors,
    invitationBlocked,
    pendingInvitations,
    pendingLoading,
    pendingError,
    loadPendingInvitations,
    loadInvitation,
    actOnInvitation,
    prepareNotificationTarget,
    receiveNotification,
  }
})
