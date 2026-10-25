export const calls = []
export const responses = new Map()
export const invitation = (patch = {}) => ({
  id: 'invite-1',
  email: 'invitee@example.com',
  organizationId: 'org-1',
  role: 'MEMBER',
  status: 'PENDING',
  expiresAt: '2099-01-01T00:00:00.000Z',
  sentById: 'sender-1',
  acceptedAt: null,
  createdAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
  organization: { id: 'org-1', name: 'Beacon', slug: 'beacon' },
  sentBy: { id: 'sender-1', name: 'Sender', email: 'sender@example.com' },
  ...patch,
})

async function request(method, path, params) {
  calls.push({ method, path, params })
  const response = responses.get(`${method} ${path}`)
  if (response instanceof Error) throw response
  if (response !== undefined) {
    return typeof response === 'function' ? response(params) : await response
  }
  if (path === '/notifications/unread-count') return { count: 2 }
  if (path === '/notifications') return { data: [], meta: { total: 0 } }
  if (path === '/invitations/pending') return []
  if (path.startsWith('/invitations/by-id/')) {
    return invitation({
      status: path.endsWith('/accept')
        ? 'ACCEPTED'
        : path.endsWith('/decline')
          ? 'DECLINED'
          : 'PENDING',
    })
  }
  if (path === '/organizations') return [{ id: 'org-1' }]
  if (path.endsWith('/projects')) return [{ id: 'project-1', organizationId: 'org-1' }]
  if (path.endsWith('/subscription')) return { effectivePlan: null, stack: [] }
  return {}
}
export const get = (path, params) => request('GET', path, params)
export const post = (path, params) => request('POST', path, params)
export const patch = (path, params) => request('PATCH', path, params)
export const del = (path, params) => request('DELETE', path, params)
export const listUserNotifications = (params) => get('/notifications', params)
export const getUserNotificationById = (id) => get(`/notifications/${encodeURIComponent(id)}`)
export const getUserNotificationUnreadCount = () => get('/notifications/unread-count')
export const markUserNotificationAsRead = (id) => patch(`/notifications/${id}/read`)
export const markAllUserNotificationsAsRead = () => patch('/notifications/read-all')
export const deleteUserNotification = (id) => del(`/notifications/${id}`)
export const listOrganizations = () => get('/organizations')
export const listProjects = (id) => get(`/organizations/${id}/projects`)
export const getSubscriptionStack = (id) => get(`/organizations/${id}/subscription`)
export const getProfile = () => get('/profile')
export const login = () => post('/login')
export const logout = () => post('/logout')
export const isTwoFactorChallenge = () => false
export const consumeNotificationStream = (_, signal) =>
  new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
export function reset() {
  calls.length = 0
  responses.clear()
}
